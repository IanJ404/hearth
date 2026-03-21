import { HomeAssistantIntegration } from "./homeassistant.js";
import { HomeyIntegration } from "./homey.js";
import { HomeKitIntegration } from "./homekit.js";
import { GoogleHomeIntegration } from "./google.js";

export interface ExternalDevice {
  externalId: string;
  name: string;
  type: string;
  state: Record<string, unknown>;
  icon?: string;
}

export interface Integration {
  readonly id: string;
  readonly name: string;
  configure(config: Record<string, unknown>): void;
  testConnection(): Promise<{ ok: boolean; error?: string }>;
  syncDevices(): Promise<ExternalDevice[]>;
  setState(externalId: string, state: Record<string, unknown>): Promise<void>;
  startRealtime(
    onUpdate: (externalId: string, state: Record<string, unknown>) => void,
  ): void;
  stopRealtime(): void;
}

const integrations: Map<string, Integration> = new Map();

export function initIntegrations() {
  integrations.set("homeassistant", new HomeAssistantIntegration());
  integrations.set("homey", new HomeyIntegration());
  integrations.set("homekit", new HomeKitIntegration());
  integrations.set("google", new GoogleHomeIntegration());
}

export function getIntegration(id: string): Integration | undefined {
  return integrations.get(id);
}

export function getAllIntegrations(): Integration[] {
  return Array.from(integrations.values());
}
