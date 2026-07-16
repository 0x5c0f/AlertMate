
import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
// Load .env.local overrides if present
dotenvConfig({ path: ".env.local", override: true });
import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import YAML from "yaml";
import { GoogleGenAI } from "@google/genai";
import jwt from "jsonwebtoken";
import { AlertmanagerState, AlertmanagerConfig, Silence, Route, Receiver } from "./src/types.js";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

// Persistent Storage Location
const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "alertmanager_config_v2.json");

// Ensure Data Directory Exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper to clean up internal Route objects to match official Alertmanager YAML structure
function cleanRouteForYaml(route: Route): any {
  const { id, routes, ...clean } = route;
  const result: any = { ...clean };
  
  if (routes && routes.length > 0) {
    result.routes = routes.map(cleanRouteForYaml);
  }
  
  return result;
}

// Helper to clean up internal Receiver objects to match official Alertmanager YAML structure
function cleanReceiverForYaml(receiver: Receiver): any {
  const result: any = {
    name: receiver.name
  };
  
  if (receiver.slack_configs && receiver.slack_configs.length > 0) {
    result.slack_configs = receiver.slack_configs;
  }
  
  if (receiver.wechat_configs && receiver.wechat_configs.length > 0) {
    result.wechat_configs = receiver.wechat_configs;
  }
  
  if (receiver.webhook_configs && receiver.webhook_configs.length > 0) {
    result.webhook_configs = receiver.webhook_configs;
  }
  
  if (receiver.email_configs && receiver.email_configs.length > 0) {
    result.email_configs = receiver.email_configs;
  }
  
  if (receiver.pagerduty_configs && receiver.pagerduty_configs.length > 0) {
    result.pagerduty_configs = receiver.pagerduty_configs;
  }

  // Handle DingTalk webhook configs
  // Since DingTalk configs are not in standard open-source alertmanager directly (usually handled via alertmanager-dingtalk-receiver webhook),
  // we represent them in the YAML as a webhook config proxying to a template, or as webhook_configs with custom annotations
  if (receiver.dingtalk_configs && receiver.dingtalk_configs.length > 0) {
    if (!result.webhook_configs) {
      result.webhook_configs = [];
    }
    receiver.dingtalk_configs.forEach(dt => {
      result.webhook_configs.push({
        url: dt.webhook_url,
        send_resolved: dt.send_resolved ?? true,
        // Optional custom metadata in alertmanager webhooks can be carried or custom-formatted
      });
    });
  }
  
  return result;
}

// Convert internal visual configuration state to actual Alertmanager YAML structure
function buildAlertmanagerYaml(config: AlertmanagerConfig): string {
  const yamlObj: any = {};
  
  if (config.global) {
    // Only include non-empty properties
    const globalObj: any = {};
    if (config.global.resolve_timeout) globalObj.resolve_timeout = config.global.resolve_timeout;
    if (config.global.smtp_smarthost) globalObj.smtp_smarthost = config.global.smtp_smarthost;
    if (config.global.smtp_from) globalObj.smtp_from = config.global.smtp_from;
    if (config.global.smtp_auth_username) globalObj.smtp_auth_username = config.global.smtp_auth_username;
    if (config.global.smtp_auth_password) globalObj.smtp_auth_password = config.global.smtp_auth_password;
    if (config.global.slack_api_url) globalObj.slack_api_url = config.global.slack_api_url;
    
    if (Object.keys(globalObj).length > 0) {
      yamlObj.global = globalObj;
    }
  }
  
  // Parse route tree
  if (config.route) {
    yamlObj.route = cleanRouteForYaml(config.route);
  }
  
  // Parse receivers
  if (config.receivers) {
    yamlObj.receivers = config.receivers.map(cleanReceiverForYaml);
  }
  
  // Parse inhibit rules
  if (config.inhibit_rules && config.inhibit_rules.length > 0) {
    yamlObj.inhibit_rules = config.inhibit_rules.map(rule => {
      const { id, ...cleanRule } = rule;
      return cleanRule;
    });
  }

  // Preserve templates if configured
  if (config.templates && config.templates.length > 0) {
    yamlObj.templates = config.templates;
  }
  
  return YAML.stringify(yamlObj, {
    indent: 2,
    lineWidth: 0,
  });
}

// Bootstrapped Default State — minimal Alertmanager-compatible template
const DEFAULT_STATE: AlertmanagerState = {
  targetAlertmanagerUrl: process.env.ALERTMANAGER_URL || "http://localhost:9093",
  config: {
    global: {
      resolve_timeout: "5m",
    },
    route: {
      id: "root",
      receiver: "default-receiver",
      group_by: ["alertname"],
      group_wait: "30s",
      group_interval: "5m",
      repeat_interval: "4h",
    },
    receivers: [
      {
        id: "rec-1",
        name: "default-receiver",
      }
    ],
  },
  silences: [],
};

// Auth Configuration
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const JWT_SECRET = process.env.JWT_SECRET || (ADMIN_PASSWORD ? `am-configurer-${ADMIN_PASSWORD}` : "change-me");
const AUTH_ENABLED = !!ADMIN_PASSWORD;

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!AUTH_ENABLED) return next();
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Authentication required" });
  try { jwt.verify(header.slice(7), JWT_SECRET); next(); }
  catch { res.status(401).json({ error: "Invalid or expired token" }); }
}

// AI Provider Configuration (from environment variables)
// AI Copilot — set AI_ENABLED=true to activate
const AI_ENABLED = process.env.AI_ENABLED === "true";
const AI_PROVIDER = process.env.AI_PROVIDER || "gemini";
const AI_BASE_URL = process.env.AI_BASE_URL || "";
const AI_API_KEY = process.env.AI_API_KEY || "";
const AI_MODEL = process.env.AI_MODEL || (AI_PROVIDER === "custom" ? "gpt-4o" : "gemini-3.5-flash");

// Validate AI config at startup if enabled
if (AI_ENABLED && !AI_API_KEY) {
  console.warn("[Alertmanager Configurer] AI_ENABLED=true but AI_API_KEY is not set. AI Copilot will return errors.");
}

// Lazy Initialized Gemini API Client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const key = AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("AI_API_KEY or GEMINI_API_KEY environment variable is not configured.");
    }
    geminiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });
  }
  return geminiClient;
}

// Load configurations from local disk
function loadState(): AlertmanagerState {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error("Error loading config state from disk, using defaults:", err);
  }
  return DEFAULT_STATE;
}

// Save configuration to disk
function saveState(state: AlertmanagerState) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving config state to disk:", err);
  }
}


// API: Auth status
app.get("/api/auth/status", (req, res) => {
  let authenticated = !AUTH_ENABLED;
  if (AUTH_ENABLED) {
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      try { jwt.verify(header.slice(7), JWT_SECRET); authenticated = true; } catch {}
    }
  }
  res.json({ authEnabled: AUTH_ENABLED, authenticated, aiEnabled: AI_ENABLED });
});

app.post("/api/auth/login", (req, res) => {
  const { password } = req.body;
  if (!AUTH_ENABLED) return res.json({ token: "", message: "Auth not configured" });
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: "Invalid password" });
  const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "24h" });
  res.json({ token });
});

// API: Get Current Config State
app.get("/api/config", (req, res) => {
  const state = loadState();
  res.json(state);
});

// API: Save Config State
app.post("/api/config", (req, res) => {
  const newState = req.body as AlertmanagerState;
  if (!newState || !newState.config) {
    return res.status(400).json({ error: "Invalid payload: config is required" });
  }
  saveState(newState);
  res.json({ success: true, message: "Configuration saved successfully" });
});

// API: Validate Alertmanager YAML Configuration
app.post("/api/validate", (req, res) => {
  const { config } = req.body;
  if (!config) {
    return res.status(400).json({ error: "Config payload is required" });
  }

  try {
    // Generate actual YAML string representation
    const yamlString = buildAlertmanagerYaml(config);
    
    // Parse YAML to catch basic syntax errors
    const parsed = YAML.parse(yamlString);
    
    // Perform Prometheus Alertmanager standard validations
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Validate: At least one receiver defined
    if (!parsed.receivers || parsed.receivers.length === 0) {
      errors.push("validation error: no receivers defined");
    } else {
      // Validate: All receivers must have names and unique names
      const receiverNames = new Set<string>();
      parsed.receivers.forEach((rec: any, idx: number) => {
        if (!rec.name) {
          errors.push(`validation error: receiver at index ${idx} is missing a name`);
        } else if (receiverNames.has(rec.name)) {
          errors.push(`validation error: duplicate receiver name found: "${rec.name}"`);
        } else {
          receiverNames.add(rec.name);
        }
      });

      // Validate: Route tree refers to existing receivers
      if (parsed.route) {
        const validateRouteReceivers = (route: any, pathStr: string) => {
          if (route.receiver && !receiverNames.has(route.receiver)) {
            errors.push(`validation error: route at "${pathStr}" references non-existent receiver "${route.receiver}"`);
          }
          if (route.routes && Array.isArray(route.routes)) {
            route.routes.forEach((subRoute: any, sIdx: number) => {
              validateRouteReceivers(subRoute, `${pathStr} -> subroute[${sIdx}]`);
            });
          }
        };
        validateRouteReceivers(parsed.route, "root");
      }
    }

    // Validate: Root route must specify a default receiver
    if (parsed.route && !parsed.route.receiver) {
      errors.push("validation error: root route must have a default receiver");
    }

    // Validate: Matchers syntax
    const validateMatchers = (route: any, pathStr: string) => {
      if (route.matchers && Array.isArray(route.matchers)) {
        route.matchers.forEach((matcher: string) => {
          // Alertmanager matchers are usually format: label=value or label=~value or label!=value or label!~value
          const match = matcher.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*(!=|!~|=~|=)\s*"(.*)"$/);
          if (!match) {
            errors.push(`validation error: matcher "${matcher}" at "${pathStr}" is not valid Alertmanager syntax (must be: label=\"value\", e.g. severity=\"critical\")`);
          }
        });
      }
      if (route.routes && Array.isArray(route.routes)) {
        route.routes.forEach((subRoute: any, sIdx: number) => {
          validateMatchers(subRoute, `${pathStr} -> subroute[${sIdx}]`);
        });
      }
    };
    if (parsed.route) {
      validateMatchers(parsed.route, "root");
    }

    // Validate inhibit rules
    if (parsed.inhibit_rules && Array.isArray(parsed.inhibit_rules)) {
      parsed.inhibit_rules.forEach((rule: any, idx: number) => {
        if (!rule.target_matchers || rule.target_matchers.length === 0) {
          warnings.push(`validation warning: inhibit rule ${idx + 1} has no target matchers`);
        }
        if (!rule.source_matchers || rule.source_matchers.length === 0) {
          warnings.push(`validation warning: inhibit rule ${idx + 1} has no source matchers`);
        }
      });
    }

    const isValid = errors.length === 0;

    // Build the amtool response CLI format
    let consoleOutput = "";
    consoleOutput += "Checking alertmanager configuration...\n";
    
    if (isValid) {
      consoleOutput += `SUCCESS: Alertmanager configuration is VALID.\n`;
      if (warnings.length > 0) {
        consoleOutput += `Warnings found during check:\n`;
        warnings.forEach(w => {
          consoleOutput += `  - ${w}\n`;
        });
      }
    } else {
      consoleOutput += `FAILED: Found ${errors.length} error(s) and ${warnings.length} warning(s) in configuration:\n`;
      errors.forEach(e => {
        consoleOutput += `  ✖ ${e}\n`;
      });
      warnings.forEach(w => {
        consoleOutput += `  ⚠ ${w}\n`;
      });
    }

    res.json({
      valid: isValid,
      yaml: yamlString,
      errors,
      warnings,
      output: consoleOutput
    });

  } catch (err: any) {
    res.json({
      valid: false,
      yaml: "",
      errors: [err.message || "YAML Syntax Error"],
      warnings: [],
      output: `FAILED: YAML Parser Error:\n  ✖ ${err.message || "Parse Exception"}`
    });
  }
});

// Helper: recursively strip <secret> placeholders from parsed Alertmanager config
function stripSecrets(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") {
    return obj === "<secret>" ? "" : obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(stripSecrets);
  }
  if (typeof obj === "object") {
    const result: any = {};
    for (const key of Object.keys(obj)) {
      result[key] = stripSecrets(obj[key]);
    }
    return result;
  }
  return obj;
}

// Helper: convert Alertmanager standard YAML config to internal format with IDs
function convertAmConfigToInternal(rawConfig: any): AlertmanagerConfig {
  // Strip <secret> placeholders first
  const cleaned = stripSecrets(rawConfig);
  
  let recIdx = 1;
  let routeIdx = 1;

  // Add IDs to receivers
  const receivers: Receiver[] = (cleaned.receivers || []).map((r: any) => ({
    id: `rec-${recIdx++}`,
    ...r,
  }));

  // Add IDs to routes recursively
  function addRouteIds(route: any): Route {
    const result: Route = {
      id: routeIdx++ === 1 ? "root" : `route-${routeIdx - 1}`,
      ...route,
    };
    if (result.routes) {
      result.routes = result.routes.map(addRouteIds);
    }
    return result;
  }

  const route = cleaned.route ? addRouteIds(cleaned.route) : undefined;

  // Add IDs to inhibit rules
  const inhibit_rules = (cleaned.inhibit_rules || []).map((r: any, i: number) => ({
    id: `inhibit-${i + 1}`,
    ...r,
  }));

  return {
    global: cleaned.global || {},
    route: route || { id: "root", receiver: (receivers[0]?.name || "default") },
    receivers,
    ...(inhibit_rules.length > 0 ? { inhibit_rules } : {}),
    ...(cleaned.templates ? { templates: cleaned.templates } : {}),
  };
}

// API: Pull config from a running Alertmanager instance
app.post("/api/pull-config", async (req, res) => {
  const { targetUrl } = req.body;
  if (!targetUrl) {
    return res.status(400).json({ error: "targetUrl is required" });
  }

  const statusUrl = `${targetUrl.replace(/\/$/, "")}/api/v2/status`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const statusRes = await fetch(statusUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!statusRes.ok) {
      return res.status(502).json({
        error: `Alertmanager returned HTTP ${statusRes.status}. Ensure the target is a running Alertmanager instance.`
      });
    }

    const statusData = await statusRes.json();
    const rawYaml = statusData?.config?.original;

    if (!rawYaml) {
      return res.status(502).json({
        error: "Alertmanager returned status but no config.original field was found."
      });
    }

    // Parse YAML to JSON
    const parsed = YAML.parse(rawYaml);

    // Convert to internal format with IDs
    const internalConfig = convertAmConfigToInternal(parsed);

    res.json({
      success: true,
      config: internalConfig,
      message: `Successfully pulled configuration from Alertmanager at ${targetUrl}.`
    });
  } catch (err: any) {
    let errorMsg = err.message || "Unknown Error";
    if (err.name === "AbortError") {
      errorMsg = "Connection timed out (Alertmanager did not respond in 5 seconds)";
    }
    res.status(502).json({
      error: `Failed to reach Alertmanager at ${targetUrl}: ${errorMsg}. Please ensure Alertmanager is running and accessible.`
    });
  }
});

// API: Reload Configuration via Proxy POST /-/reload
app.post("/api/reload", authMiddleware, async (req, res) => {
  const { targetUrl } = req.body;
  if (!targetUrl) {
    return res.status(400).json({ error: "targetUrl is required" });
  }

  const reloadUrl = `${targetUrl.replace(/\/$/, "")}/-/reload`;
  console.log(`Proxying Alertmanager configuration reload to: ${reloadUrl}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 seconds timeout

    const reloadRes = await fetch(reloadUrl, {
      method: "POST",
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (reloadRes.ok) {
      res.json({
        success: true,
        status: reloadRes.status,
        message: `Successfully called /-/reload on Alertmanager at ${targetUrl}. Configuration has been hot-reloaded.`
      });
    } else {
      const text = await reloadRes.text();
      res.status(502).json({
        success: false,
        status: reloadRes.status,
        message: `Failed to reload. Alertmanager returned status ${reloadRes.status}: ${text}`
      });
    }
  } catch (err: any) {
    let errorMsg = err.message || "Unknown Connection Error";
    if (err.name === "AbortError") {
      errorMsg = "Connection timed out (Alertmanager did not respond in 5 seconds)";
    }
    res.status(502).json({
      success: false,
      message: `Failed to reach Alertmanager at ${reloadUrl}: ${errorMsg}. Please ensure Alertmanager is running, accessible, and hot-reload is enabled (flag --web.enable-lifecycle).`
    });
  }
});

// TARGET_URL for remote proxy
const TARGET_URL = process.env.ALERTMANAGER_URL || "http://localhost:9093";

async function proxyToAlertmanager(req: express.Request, res: express.Response, amPath: string) {
  const targetUrl = req.body?.targetUrl || req.query.targetUrl as string || process.env.ALERTMANAGER_URL || "http://localhost:9093";
  try {
    const url = `${targetUrl.replace(/\/$/, "")}${amPath}`;
    const fetchOpts: RequestInit = { method: req.method, headers: { "Content-Type": "application/json" } };
    if (req.method !== "GET" && req.method !== "HEAD") fetchOpts.body = JSON.stringify(req.body);
    const amRes = await fetch(url, fetchOpts);
    const data = await amRes.json().catch(() => ({}));
    res.status(amRes.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: `Failed to reach Alertmanager: ${err.message}` });
  }
}
app.all("/api/remote/alerts",   authMiddleware, (req, res) => proxyToAlertmanager(req, res, "/api/v2/alerts"));
app.all("/api/remote/silences", authMiddleware, (req, res) => proxyToAlertmanager(req, res, "/api/v2/silences"));
app.all("/api/remote/silence/:id", authMiddleware, (req, res) => proxyToAlertmanager(req, res, `/api/v2/silence/${req.params.id}`));
app.get("/api/remote/status",   authMiddleware, (req, res) => proxyToAlertmanager(req, res, "/api/v2/status"));

// API: Get AI Copilot configuration (no secrets exposed)
app.get("/api/ai/config", (_req, res) => {
  res.json({
    enabled: AI_ENABLED,
    provider: AI_PROVIDER,
    model: AI_MODEL,
  });
});

// API: AI Copilot - Suggest/Explain alertmanager settings
app.post("/api/ai/suggest", authMiddleware, async (req, res) => {
  if (!AI_ENABLED) {
    return res.status(403).json({ error: "AI Copilot is not enabled. Set AI_ENABLED=true to activate." });
  }
  const { prompt, currentConfig, model } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  const systemInstruction = `You are a world-class site reliability engineer and Prometheus/Alertmanager operations expert. 
Your goal is to help users design, refine, and troubleshoot Prometheus Alertmanager configurations.
The user wants to generate or modify their Alertmanager configuration.
You must return your response in standard JSON format containing a "explanation" (markdown string explaining your changes) and an "updatedState" field (JSON object) containing any modified receiver lists, route trees, or inhibit rules.

You should format your JSON response to match this schema:
{
  "explanation": "Markdown text detailing what was accomplished...",
  "suggestedConfig": {
    "receivers": [ ...list of suggested receivers... ],
    "route": { ...root route tree... },
    "inhibit_rules": [ ...inhibit rules... ]
  }
}

Use the exact properties from this AlertmanagerConfig schema:
- Receivers have optional fields: id, name, slack_configs, wechat_configs, dingtalk_configs, webhook_configs, email_configs, pagerduty_configs.
- SlackConfig has: channel, api_url, username, icon_emoji, text, send_resolved.
- WechatConfig has: to_user, to_party, agent_id, api_secret, corp_id, send_resolved.
- DingtalkConfig has: webhook_url, secret, send_resolved.
- EmailConfig has: to, from, smarthost, send_resolved.
- Route has: id, receiver, group_by[], group_wait, group_interval, repeat_interval, matchers[], continue, routes[].
- InhibitRule has: id, target_matchers[], source_matchers[], equal[].

Keep existing configuration in mind if provided. Generate realistic webhook configs, channel layouts, or matchers as requested. Do not invent non-supported schemas. Make sure all IDs are uniquely generated strings (e.g. "route-suggest-1").`;

  const userPrompt = `User Request: ${prompt}
    
Current Alertmanager Config for Context (use this as a base or ignore if creating totally fresh):
${JSON.stringify(currentConfig || {}, null, 2)}`;

  try {
    let result: any;

    if (AI_PROVIDER === "custom") {
      if (!AI_BASE_URL || !AI_API_KEY) {
        return res.status(400).json({ error: "Custom AI provider not configured. Set AI_BASE_URL and AI_API_KEY environment variables." });
      }
      const apiUrl = AI_BASE_URL.replace(/\/$/, "") + "/chat/completions";
      const apiRes = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${AI_API_KEY}`,
        },
        body: JSON.stringify({
          model: model || AI_MODEL,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          response_format: { type: "json_object" },
        }),
      });

      if (!apiRes.ok) {
        const errText = await apiRes.text();
        return res.status(502).json({ error: `AI API returned ${apiRes.status}: ${errText}` });
      }

      const apiData = await apiRes.json() as any;
      const content = apiData?.choices?.[0]?.message?.content;
      if (!content) {
        return res.status(502).json({ error: "AI API returned empty response" });
      }
      result = JSON.parse(content);
    } else {
      // Use built-in Gemini
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: model || AI_MODEL,
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.7,
        }
      });
      const text = response.text;
      result = JSON.parse(text || "{}");
    }

    res.json(result);
  } catch (err: any) {
    console.error("AI suggestion error:", err);
    res.status(500).json({
      error: `AI Engine Error: ${err.message || "Failed to contact AI"}`,
      details: AI_PROVIDER === "custom"
        ? "Check AI_BASE_URL and AI_API_KEY environment variables."
        : "Ensure GEMINI_API_KEY is configured."
    });
  }
});


// Serve static/compiled assets depending on development vs production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development Mode using Vite middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production Mode serving compiled static bundle
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Alertmanager Configurer] Server running on http://localhost:${PORT} in ${process.env.NODE_ENV || "development"} mode.`);
  });
}

startServer();
