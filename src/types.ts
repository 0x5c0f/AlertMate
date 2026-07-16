
export interface Matcher {
  label: string;
  value: string;
  isRegex: boolean;
}

export interface SlackConfig {
  channel?: string;
  api_url?: string;
  username?: string;
  icon_emoji?: string;
  text?: string;
  send_resolved?: boolean;
}

export interface WechatConfig {
  to_user?: string;
  to_party?: string;
  to_tag?: string;
  agent_id?: string;
  api_secret?: string;
  api_url?: string;
  corp_id?: string;
  send_resolved?: boolean;
}

export interface DingtalkConfig {
  webhook_url: string;
  secret?: string;
  message_template?: string;
  send_resolved?: boolean;
}

export interface WebhookConfig {
  url: string;
  send_resolved?: boolean;
}

export interface EmailConfig {
  to: string;
  from?: string;
  smarthost?: string;
  auth_username?: string;
  auth_password?: string;
  send_resolved?: boolean;
}

export interface PagerdutyConfig {
  routing_key?: string;
  service_key?: string;
  severity?: string;
  client?: string;
  client_url?: string;
  send_resolved?: boolean;
}

export interface Receiver {
  id: string;
  name: string;
  slack_configs?: SlackConfig[];
  wechat_configs?: WechatConfig[];
  dingtalk_configs?: DingtalkConfig[]; // Simulated/supported as custom or direct webhook
  webhook_configs?: WebhookConfig[];
  email_configs?: EmailConfig[];
  pagerduty_configs?: PagerdutyConfig[];
}

export interface Route {
  id: string;
  receiver: string;
  group_by?: string[];
  group_wait?: string;
  group_interval?: string;
  repeat_interval?: string;
  matchers?: string[];
  continue?: boolean;
  routes?: Route[];
}

export interface InhibitRule {
  id: string;
  target_matchers?: string[];
  source_matchers?: string[];
  equal?: string[];
}

export interface Silence {
  id: string;
  matchers: Matcher[];
  startsAt: string;
  endsAt: string;
  createdBy: string;
  comment: string;
  status?: 'active' | 'pending' | 'expired';
}

export interface AlertmanagerConfig {
  global?: {
    resolve_timeout?: string;
    smtp_smarthost?: string;
    smtp_from?: string;
    smtp_auth_username?: string;
    smtp_auth_password?: string;
    slack_api_url?: string;
  };
  route: Route; // Root route
  receivers: Receiver[];
  inhibit_rules?: InhibitRule[];
}

export interface AlertmanagerState {
  config: AlertmanagerConfig;
  silences: Silence[];
  targetAlertmanagerUrl: string;
}
