export interface Room {
  id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  created_at: string;
  device_count?: number;
}

export interface Device {
  id: string;
  room_id: string | null;
  name: string;
  type: DeviceType;
  state: Record<string, unknown>;
  integration: string;
  external_id: string | null;
  icon: string | null;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export type DeviceType =
  | "light"
  | "switch"
  | "thermostat"
  | "sensor"
  | "lock"
  | "camera"
  | "fan"
  | "cover";

export interface Schedule {
  id: string;
  name: string;
  cron: string;
  action: ScheduleAction;
  enabled: number;
  last_run: string | null;
  next_run: string | null;
  created_at: string;
}

export interface ScheduleAction {
  type: string;
  device_id?: string;
  room_id?: string | null;
  state?: Record<string, unknown>;
}

export interface HEvent {
  id: string;
  type: EventType;
  description: string;
  device_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type EventType =
  | "device_change"
  | "schedule_run"
  | "integration_sync"
  | "ai_action"
  | "error";

export interface IntegrationConfig {
  id: string;
  name: string;
  enabled: number;
  last_sync: string | null;
  config: Record<string, unknown>;
}

export interface DiscoveredDevice {
  id: string;
  name: string;
  type: string;
  protocol: "mdns" | "ssdp";
  host: string;
  port?: number;
  addresses?: string[];
  serviceType?: string;
  udn?: string;
  seen: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
