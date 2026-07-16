
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
import { timingSafeEqual } from "crypto";
import { AlertmanagerState, AlertmanagerConfig, Silence, Route, Receiver } from "./src/types.js";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "1mb" }));

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
    yamlObj.global = { ...config.global };
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
if (ADMIN_PASSWORD) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    console.error("[Alertmanager Configurer] FATAL: JWT_SECRET must be set to a strong random value (min 16 chars) when ADMIN_PASSWORD is configured.");
    process.exit(1);
  }
}
const JWT_SECRET = process.env.JWT_SECRET || "";
const AUTH_ENABLED = !!ADMIN_PASSWORD;

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!AUTH_ENABLED) return next();
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Authentication required" });
  try { jwt.verify(header.slice(7), JWT_SECRET, { algorithms: ["HS256"] }); next(); }
  catch { res.status(401).json({ error: "Invalid or expired token" }); }
}

// API: Auth status
app.get("/api/auth/status", (req, res) => {
  let authenticated = !AUTH_ENABLED;
  if (AUTH_ENABLED) {
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      try { jwt.verify(header.slice(7), JWT_SECRET, { algorithms: ["HS256"] }); authenticated = true; } catch {}
    }
  }
  res.json({ authEnabled: AUTH_ENABLED, authenticated, aiEnabled: AI_ENABLED });
});

app.post("/api/auth/login", (req, res) => {
  const { password } = req.body;
  if (!AUTH_ENABLED) return res.json({ token: "", message: "Auth not configured" });
  const a = Buffer.from(password || ""), b = Buffer.from(ADMIN_PASSWORD);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return res.status(401).json({ error: "Invalid password" });
  const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "24h" });
  res.json({ token });
});

// AI Provider Configuration (from environment variables)
// AI Copilot — set AI_ENABLED=true to activate
const AI_ENABLED = process.env.AI_ENABLED === "true";
const AI_PROVIDER = process.env.AI_PROVIDER || "gemini";
const AI_BASE_URL = process.env.AI_BASE_URL || "";
const AI_API_KEY = process.env.AI_API_KEY || "";
const AI_MODEL = process.env.AI_MODEL || (AI_PROVIDER === "custom" ? "gpt-4o" : "gemini-2.5-flash");

// Validate AI config at startup - AI requires auth to prevent API key abuse
if (AI_ENABLED && !ADMIN_PASSWORD) {
  console.error("[Alertmanager Configurer] FATAL: AI_ENABLED=true requires ADMIN_PASSWORD to be set to prevent unauthorized API usage.");
  process.exit(1);
}
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

// API: Get Current Config State (read-only, no server-side persistence)
app.get("/api/config", (req, res) => {
  if (AUTH_ENABLED) {
    const clean = JSON.parse(JSON.stringify(DEFAULT_STATE));
    if (clean.config?.global) {
      clean.config.global.smtp_auth_password = '';
      clean.config.global.slack_api_url = '';
    }
    if (clean.config?.receivers) clean.config.receivers.forEach((r: any) => {
      if (r.wechat_configs) r.wechat_configs = r.wechat_configs.map((w: any) => ({ ...w, api_secret: '' }));
      if (r.email_configs) r.email_configs = r.email_configs.map((e: any) => ({ ...e, auth_password: '' }));
      if (r.dingtalk_configs) r.dingtalk_configs = r.dingtalk_configs.map((d: any) => ({ ...d, secret: '' }));
      if (r.slack_configs) r.slack_configs = r.slack_configs.map((s: any) => ({ ...s, api_url: '' }));
      if (r.webhook_configs) r.webhook_configs = r.webhook_configs.map((w: any) => ({ ...w, url: '' }));
      if (r.pagerduty_configs) r.pagerduty_configs = r.pagerduty_configs.map((p: any) => ({ ...p, routing_key: '', service_key: '' }));
    });
    res.json(clean);
  } else { res.json(DEFAULT_STATE); }
});

// API: Parse raw Alertmanager YAML to internal format (no outbound requests)
app.post("/api/parse-yaml", (req, res) => {
  try {
    const { yaml: yamlStr } = req.body;
    if (!yamlStr) return res.status(400).json({ error: "yaml field is required" });
    const parsed = YAML.parse(yamlStr);
    const stripSecrets = (obj: any): any => {
      if (typeof obj === "string") return obj === "<secret>" ? "" : obj;
      if (Array.isArray(obj)) return obj.map(stripSecrets);
      if (typeof obj === "object" && obj) { const r: any = {}; for (const k of Object.keys(obj)) r[k] = stripSecrets(obj[k]); return r; }
      return obj;
    };
    const cleaned = stripSecrets(parsed);
    let recIdx = 1, routeIdx = 1;
    const receivers = (cleaned.receivers || []).map((r: any) => ({ id: `rec-${recIdx++}`, ...r }));
    const addRouteIds = (r: any): Route => {
      const result: Route = { id: routeIdx++ === 1 ? "root" : `route-${routeIdx - 1}`, ...r };
      if (result.routes) result.routes = result.routes.map(addRouteIds);
      return result;
    };
    const route = cleaned.route ? addRouteIds(cleaned.route) : { id: "root", receiver: (receivers[0]?.name || "default") };
    const inhibit_rules = (cleaned.inhibit_rules || []).map((r: any, i: number) => ({ id: `inhibit-${i + 1}`, ...r }));
    const config: any = { global: cleaned.global || {}, route, receivers };
    if (inhibit_rules.length > 0) config.inhibit_rules = inhibit_rules;
    if (cleaned.templates) config.templates = cleaned.templates;
    res.json({ config });
  } catch (err: any) { res.json({ error: `YAML parse error: ${err.message}` }); }
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
      try { result = JSON.parse(content); } catch { return res.status(502).json({ error: "AI returned non-JSON response" }); }
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
      try { result = JSON.parse(text || "{}"); } catch { result = { explanation: "AI returned non-JSON response", suggestedConfig: {} }; }
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
    console.log(`[AlertMate] Server running on http://localhost:${PORT} in ${process.env.NODE_ENV || "development"} mode.`);
  });
}

// Only auto-start in local dev (not on Vercel)
if (!process.env.VERCEL) {
  startServer();
}

export default app;
