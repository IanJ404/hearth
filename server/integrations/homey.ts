import { WebSocket } from "ws";
import type { Integration, ExternalDevice } from "./index.js";

const CLASS_TO_TYPE: Record<string, string> = {
  light: "light",
  socket: "switch",
  thermostat: "thermostat",
  sensor: "sensor",
  lock: "lock",
  camera: "camera",
  fan: "fan",
  curtain: "cover",
  blinds: "cover",
  windowcoverings: "cover",
};

interface HomeyDevice {
  id: string;
  name: string;
  class: string;
  capabilities: string[];
  capabilitiesObj: Record<string, { value: unknown; units?: string }>;
}

export class HomeyIntegration implements Integration {
  readonly id = "homey";
  readonly name = "Homey";

  private url = "";
  private token = "";
  private ws: WebSocket | null = null;
  private onUpdate?: (
    externalId: string,
    state: Record<string, unknown>,
  ) => void;

  configure(config: Record<string, unknown>) {
    this.url = (config.url as string) || "";
    this.token = (config.token as string) || "";
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    if (!this.url || !this.token) {
      return { ok: false, error: "URL and token are required" };
    }
    try {
      const res = await fetch(`${this.url}/api/manager/devices/device`, {
        headers: { Authorization: `Bearer ${this.token}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  async syncDevices(): Promise<ExternalDevice[]> {
    if (!this.url || !this.token) return [];
    const res = await fetch(`${this.url}/api/manager/devices/device`, {
      headers: { Authorization: `Bearer ${this.token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Homey API error: ${res.status}`);
    const data = (await res.json()) as Record<string, HomeyDevice>;
    const devices: ExternalDevice[] = [];

    for (const device of Object.values(data)) {
      const type = CLASS_TO_TYPE[device.class];
      if (!type) continue;

      devices.push({
        externalId: device.id,
        name: device.name,
        type,
        state: this.parseState(device),
        icon: this.iconForType(type),
      });
    }
    return devices;
  }

  async setState(
    externalId: string,
    state: Record<string, unknown>,
  ): Promise<void> {
    if (!this.url || !this.token) throw new Error("Not configured");
    const capabilities = this.stateToCapabilities(state);
    for (const [cap, value] of Object.entries(capabilities)) {
      await fetch(
        `${this.url}/api/manager/devices/device/${externalId}/capability/${cap}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ value }),
          signal: AbortSignal.timeout(5000),
        },
      );
    }
  }

  startRealtime(
    onUpdate: (externalId: string, state: Record<string, unknown>) => void,
  ) {
    this.onUpdate = onUpdate;
    if (!this.url || !this.token) return;

    const wsUrl = this.url.replace(/^http/, "ws") + "/api";
    this.ws = new WebSocket(wsUrl, {
      headers: { Authorization: `Bearer ${this.token}` },
    });

    this.ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.event === "device.capability.set") {
          const { deviceId, capabilityId, value } = msg.data || {};
          if (!deviceId) return;
          const partial: Record<string, unknown> = {};
          if (capabilityId === "onoff") partial.on = value;
          else if (capabilityId === "dim")
            partial.brightness = Math.round((value as number) * 100);
          else if (capabilityId === "target_temperature")
            partial.target_temp = value;
          else if (capabilityId === "measure_temperature")
            partial.current_temp = value;
          else if (capabilityId === "locked") partial.locked = value;
          if (Object.keys(partial).length > 0) {
            this.onUpdate?.(deviceId, partial);
          }
        }
      } catch {
        // ignore
      }
    });

    this.ws.on("error", () => {
      // reconnect handled externally
    });
  }

  stopRealtime() {
    this.ws?.close();
    this.ws = null;
  }

  private parseState(device: HomeyDevice): Record<string, unknown> {
    const caps = device.capabilitiesObj || {};
    const result: Record<string, unknown> = {};

    if ("onoff" in caps) result.on = caps.onoff.value as boolean;
    if ("dim" in caps)
      result.brightness = Math.round((caps.dim.value as number) * 100);
    if ("light_temperature" in caps)
      result.color_temp = Math.round(
        2700 + (caps.light_temperature.value as number) * 3300,
      );
    if ("target_temperature" in caps)
      result.target_temp = caps.target_temperature.value;
    if ("measure_temperature" in caps)
      result.current_temp = caps.measure_temperature.value;
    if ("locked" in caps) result.locked = caps.locked.value as boolean;
    if ("windowcoverings_set" in caps)
      result.position = Math.round(
        (caps.windowcoverings_set.value as number) * 100,
      );
    if ("measure_humidity" in caps) {
      result.value = caps.measure_humidity.value;
      result.unit = "%";
    }

    return result;
  }

  private stateToCapabilities(
    state: Record<string, unknown>,
  ): Record<string, unknown> {
    const caps: Record<string, unknown> = {};
    if ("on" in state) caps.onoff = state.on;
    if ("brightness" in state) caps.dim = (state.brightness as number) / 100;
    if ("target_temp" in state) caps.target_temperature = state.target_temp;
    if ("locked" in state) caps.locked = state.locked;
    if ("position" in state)
      caps.windowcoverings_set = (state.position as number) / 100;
    return caps;
  }

  private iconForType(type: string): string {
    const icons: Record<string, string> = {
      light: "lightbulb",
      switch: "plug",
      thermostat: "thermometer",
      sensor: "activity",
      lock: "lock",
      camera: "camera",
      cover: "door-open",
      fan: "wind",
    };
    return icons[type] || "zap";
  }
}
