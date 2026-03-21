import { WebSocket } from "ws";
import type { Integration, ExternalDevice } from "./index.js";

const DOMAIN_TO_TYPE: Record<string, string> = {
  light: "light",
  switch: "switch",
  climate: "thermostat",
  sensor: "sensor",
  binary_sensor: "sensor",
  lock: "lock",
  camera: "camera",
  cover: "cover",
  fan: "fan",
};

interface HAState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

export class HomeAssistantIntegration implements Integration {
  readonly id = "homeassistant";
  readonly name = "Home Assistant";

  private url = "";
  private token = "";
  private ws: WebSocket | null = null;
  private msgId = 1;
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
      const res = await fetch(`${this.url}/api/`, {
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
    const res = await fetch(`${this.url}/api/states`, {
      headers: { Authorization: `Bearer ${this.token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HA API error: ${res.status}`);
    const states = (await res.json()) as HAState[];
    const devices: ExternalDevice[] = [];

    for (const entity of states) {
      const domain = entity.entity_id.split(".")[0];
      const type = DOMAIN_TO_TYPE[domain];
      if (!type) continue;

      const state = this.parseState(entity);
      devices.push({
        externalId: entity.entity_id,
        name: (
          (entity.attributes.friendly_name as string) || entity.entity_id
        ).replace(/_/g, " "),
        type,
        state,
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
    const domain = externalId.split(".")[0];
    const service = this.serviceForState(domain, state);
    await fetch(
      `${this.url}/api/services/${service.domain}/${service.service}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ entity_id: externalId, ...service.data }),
        signal: AbortSignal.timeout(5000),
      },
    );
  }

  startRealtime(
    onUpdate: (externalId: string, state: Record<string, unknown>) => void,
  ) {
    this.onUpdate = onUpdate;
    if (!this.url || !this.token) return;

    const wsUrl = this.url.replace(/^http/, "ws") + "/api/websocket";
    this.ws = new WebSocket(wsUrl);

    this.ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "auth_required") {
          this.ws!.send(
            JSON.stringify({ type: "auth", access_token: this.token }),
          );
        } else if (msg.type === "auth_ok") {
          this.ws!.send(
            JSON.stringify({
              id: this.msgId++,
              type: "subscribe_events",
              event_type: "state_changed",
            }),
          );
        } else if (
          msg.type === "event" &&
          msg.event?.event_type === "state_changed"
        ) {
          const newState: HAState = msg.event.data.new_state;
          if (!newState) return;
          const domain = newState.entity_id.split(".")[0];
          if (!DOMAIN_TO_TYPE[domain]) return;
          const state = this.parseState(newState);
          this.onUpdate?.(newState.entity_id, state);
        }
      } catch {
        // ignore parse errors
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

  private parseState(entity: HAState): Record<string, unknown> {
    const attrs = entity.attributes;
    const domain = entity.entity_id.split(".")[0];
    const on =
      entity.state !== "off" &&
      entity.state !== "unavailable" &&
      entity.state !== "unknown";

    if (domain === "light") {
      return {
        on,
        brightness: attrs.brightness
          ? Math.round((attrs.brightness as number) / 2.55)
          : 100,
        color_temp: attrs.color_temp_kelvin || 4000,
      };
    }
    if (domain === "climate") {
      return {
        on,
        current_temp: attrs.current_temperature,
        target_temp: attrs.temperature,
        mode: entity.state,
      };
    }
    if (domain === "sensor" || domain === "binary_sensor") {
      return {
        value: entity.state,
        unit: attrs.unit_of_measurement || "",
      };
    }
    if (domain === "lock") {
      return { locked: entity.state === "locked" };
    }
    if (domain === "cover") {
      return { position: attrs.current_position || 0, state: entity.state };
    }
    return { on, raw: entity.state };
  }

  private serviceForState(domain: string, state: Record<string, unknown>) {
    if (domain === "light") {
      return {
        domain: "light",
        service: state.on ? "turn_on" : "turn_off",
        data: state.on
          ? {
              brightness_pct: state.brightness,
              color_temp_kelvin: state.color_temp,
            }
          : {},
      };
    }
    if (domain === "switch" || domain === "fan") {
      return {
        domain,
        service: state.on ? "turn_on" : "turn_off",
        data: {},
      };
    }
    if (domain === "climate") {
      return {
        domain: "climate",
        service: "set_temperature",
        data: { temperature: state.target_temp },
      };
    }
    if (domain === "lock") {
      return {
        domain: "lock",
        service: state.locked ? "lock" : "unlock",
        data: {},
      };
    }
    if (domain === "cover") {
      return {
        domain: "cover",
        service: "set_cover_position",
        data: { position: state.position },
      };
    }
    return { domain, service: "turn_on", data: {} };
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
