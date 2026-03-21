import type { Integration, ExternalDevice } from "./index.js";

const SDM_BASE = "https://smartdevicemanagement.googleapis.com/v1";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPE = "https://www.googleapis.com/auth/sdm.service";

interface GoogleConfig {
  projectId?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: number; // ms timestamp
}

export class GoogleHomeIntegration implements Integration {
  readonly id = "google";
  readonly name = "Google Home";

  private cfg: GoogleConfig = {};
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  configure(config: Record<string, unknown>): void {
    this.cfg = config as GoogleConfig;
  }

  // Called by the OAuth route to build the authorization URL
  getAuthUrl(redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.cfg.clientId ?? "",
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPE,
      access_type: "offline",
      prompt: "consent",
    });
    return `${AUTH_URL}?${params}`;
  }

  // Called by the OAuth callback route after Google redirects back
  async exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiry: number }> {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.cfg.clientId ?? "",
        client_secret: this.cfg.clientSecret ?? "",
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Token exchange failed: ${text}`);
    }
    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiry: Date.now() + data.expires_in * 1000,
    };
  }

  private async getAccessToken(): Promise<string> {
    // Use existing token if not expired (with 60s buffer)
    if (
      this.cfg.accessToken &&
      this.cfg.tokenExpiry &&
      Date.now() < this.cfg.tokenExpiry - 60_000
    ) {
      return this.cfg.accessToken;
    }
    if (!this.cfg.refreshToken) {
      throw new Error(
        "Not authenticated — use 'Connect with Google' to authorise",
      );
    }
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: this.cfg.refreshToken,
        client_id: this.cfg.clientId ?? "",
        client_secret: this.cfg.clientSecret ?? "",
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Token refresh failed: ${text}`);
    }
    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.cfg.accessToken = data.access_token;
    this.cfg.tokenExpiry = Date.now() + data.expires_in * 1000;
    return this.cfg.accessToken;
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      if (!this.cfg.projectId || !this.cfg.clientId || !this.cfg.clientSecret) {
        return {
          ok: false,
          error: "Project ID, Client ID and Client Secret are required",
        };
      }
      if (!this.cfg.refreshToken) {
        return {
          ok: false,
          error: "Not authorised — click 'Connect with Google' to sign in",
        };
      }
      const token = await this.getAccessToken();
      const res = await fetch(
        `${SDM_BASE}/enterprises/${this.cfg.projectId}/devices`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        return {
          ok: false,
          error: err.error?.message ?? `HTTP ${res.status}`,
        };
      }
      const data = (await res.json()) as { devices?: unknown[] };
      return {
        ok: true,
        error: undefined,
        ...({ deviceCount: data.devices?.length ?? 0 } as object),
      };
    } catch (err: unknown) {
      return { ok: false, error: (err as Error).message };
    }
  }

  async syncDevices(): Promise<ExternalDevice[]> {
    const token = await this.getAccessToken();
    const res = await fetch(
      `${SDM_BASE}/enterprises/${this.cfg.projectId}/devices`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      throw new Error(err.error?.message ?? `HTTP ${res.status}`);
    }
    const data = (await res.json()) as { devices?: unknown[] };
    const devices: ExternalDevice[] = [];
    for (const d of data.devices ?? []) {
      const mapped = mapSdmDevice(d as SdmDevice);
      if (mapped) devices.push(mapped);
    }
    return devices;
  }

  async setState(
    externalId: string,
    state: Record<string, unknown>,
  ): Promise<void> {
    const token = await this.getAccessToken();
    const commands = buildCommands(state);
    for (const cmd of commands) {
      const res = await fetch(`${SDM_BASE}/${externalId}:executeCommand`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cmd),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(
          err.error?.message ?? `Command failed HTTP ${res.status}`,
        );
      }
    }
  }

  startRealtime(
    onUpdate: (externalId: string, state: Record<string, unknown>) => void,
  ): void {
    // Poll every 30s — Google Pub/Sub can be wired up as a future enhancement
    this.pollInterval = setInterval(async () => {
      try {
        const devices = await this.syncDevices();
        for (const d of devices) onUpdate(d.externalId, d.state);
      } catch {
        // ignore transient errors in poll
      }
    }, 30_000);
  }

  stopRealtime(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}

// ── SDM device mapping ────────────────────────────────────────────────────────

interface SdmDevice {
  name: string;
  type: string;
  traits: Record<string, Record<string, unknown>>;
}

function mapSdmDevice(d: SdmDevice): ExternalDevice | null {
  const typeKey = d.type.split(".").pop()?.toUpperCase() ?? "";
  const traits = d.traits ?? {};
  const customName =
    (traits["sdm.devices.traits.Info"]?.customName as string) ?? null;
  const name = customName || d.name.split("/").pop() || "Unknown Device";

  let type = "switch";
  let icon = "zap";
  const state: Record<string, unknown> = {};

  switch (typeKey) {
    case "THERMOSTAT": {
      type = "thermostat";
      icon = "thermometer";
      const temp = traits["sdm.devices.traits.Temperature"];
      const setpoint =
        traits["sdm.devices.traits.ThermostatTemperatureSetpoint"];
      const mode = traits["sdm.devices.traits.ThermostatMode"];
      const humidity = traits["sdm.devices.traits.Humidity"];
      const fan = traits["sdm.devices.traits.Fan"];
      state.temperature = temp?.ambientTemperatureCelsius;
      state.target_temperature =
        (setpoint?.heatCelsius as number) ??
        (setpoint?.coolCelsius as number) ??
        null;
      state.mode = ((mode?.mode as string) ?? "OFF").toLowerCase();
      state.humidity = humidity?.ambientHumidityPercent ?? null;
      state.fan = fan?.timerMode === "ON";
      break;
    }
    case "CAMERA":
    case "DISPLAY":
      type = "camera";
      icon = "camera";
      state.on = true;
      break;
    case "DOORBELL":
      type = "sensor";
      icon = "bell";
      state.value = "idle";
      break;
    default:
      return null; // unsupported SDM device type
  }

  return { externalId: d.name, name, type, state, icon };
}

function buildCommands(
  state: Record<string, unknown>,
): Array<{ command: string; params: Record<string, unknown> }> {
  const cmds: Array<{ command: string; params: Record<string, unknown> }> = [];

  if (state.mode !== undefined) {
    cmds.push({
      command: "sdm.devices.commands.ThermostatMode.SetMode",
      params: { mode: String(state.mode).toUpperCase() },
    });
  }
  if (state.target_temperature !== undefined) {
    // Assume heat setpoint; could be improved with mode context
    cmds.push({
      command: "sdm.devices.commands.ThermostatTemperatureSetpoint.SetHeat",
      params: { heatCelsius: Number(state.target_temperature) },
    });
  }

  return cmds;
}
