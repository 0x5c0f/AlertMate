
import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import YAML from "yaml";
import { GoogleGenAI } from "@google/genai";
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
  
  return YAML.stringify(yamlObj, {
    indent: 2,
    lineWidth: 0,
  });
}

// Bootstrapped Default State
const DEFAULT_STATE: AlertmanagerState = {
  targetAlertmanagerUrl: "http://localhost:9093",
  config: {
    global: {
      resolve_timeout: "5m",
      smtp_smarthost: "smtp.example.com:587",
      smtp_from: "alertmanager@example.com",
    },
    route: {
      id: "root",
      receiver: "default-receiver",
      group_by: ["alertname", "cluster", "service"],
      group_wait: "30s",
      group_interval: "5m",
      repeat_interval: "12h",
      routes: [
        {
          id: "route-1",
          receiver: "wechat-ops-critical",
          matchers: ["severity=\"critical\"", "env=\"prod\""],
          continue: true,
          routes: [
            {
              id: "route-1-1",
              receiver: "db-dba-sms",
              matchers: ["service=~\"mysql|postgresql|redis\""],
            }
          ]
        },
        {
          id: "route-2",
          receiver: "dingtalk-dev-warnings",
          matchers: ["severity=\"warning\""],
        }
      ]
    },
    receivers: [
      {
        id: "rec-1",
        name: "default-receiver",
        email_configs: [
          {
            to: "admin@example.com",
            send_resolved: true
          }
        ]
      },
      {
        id: "rec-2",
        name: "wechat-ops-critical",
        wechat_configs: [
          {
            corp_id: "ww123456789abc",
            agent_id: "1000002",
            api_secret: "secret-wechat-key-goes-here",
            to_party: "2",
            send_resolved: true
          }
        ]
      },
      {
        id: "rec-3",
        name: "dingtalk-dev-warnings",
        dingtalk_configs: [
          {
            webhook_url: "https://oapi.dingtalk.com/robot/send?access_token=mocktoken123456",
            send_resolved: true
          }
        ]
      },
      {
        id: "rec-4",
        name: "db-dba-sms",
        webhook_configs: [
          {
            url: "https://api.example.com/sms/alerts",
            send_resolved: true
          }
        ]
      }
    ],
    inhibit_rules: [
      {
        id: "inhibit-1",
        source_matchers: ["alertname=\"NodeDown\""],
        target_matchers: ["severity=\"critical\""],
        equal: ["node", "instance"]
      }
    ]
  },
  silences: [
    {
      id: "silence-1",
      matchers: [
        { label: "instance", value: "db-replica-01", isRegex: false },
        { label: "alertname", value: "CPUUsageHigh", isRegex: false }
      ],
      startsAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      endsAt: new Date(Date.now() + 8 * 3600000).toISOString(), // in 8 hours
      createdBy: "Chen (DBA Team)",
      comment: "Undergoing scheduled RAM expansion. Suppressing noisy CPU alerts.",
      status: "active"
    }
  ]
};

// Lazy Initialized Gemini API Client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is not configured. Please add it in Settings > Secrets.");
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

// API: Reload Configuration via Proxy POST /-/reload
app.post("/api/reload", async (req, res) => {
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

// API: AI Copilot - Suggest/Explain alertmanager settings
app.post("/api/ai/suggest", async (req, res) => {
  const { prompt, currentConfig, model } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  try {
    const ai = getGeminiClient();
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

    const response = await ai.models.generateContent({
      model: model || "gemini-3.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.7,
      }
    });

    const text = response.text;
    const result = JSON.parse(text || "{}");
    res.json(result);

  } catch (err: any) {
    console.error("Gemini suggestion error:", err);
    res.status(500).json({
      error: `AI Engine Error: ${err.message || "Failed to contact Gemini"}`,
      details: "Ensure your GEMINI_API_KEY is configured in the Secrets panel."
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
