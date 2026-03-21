import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  Save,
  AlertTriangle,
  LogIn,
} from "lucide-react";
import { api } from "../api";
import type { IntegrationConfig } from "../types";

const INTEGRATION_META: Record<
  string,
  {
    description: string;
    fields: { key: string; label: string; type: string; placeholder: string }[];
    stub?: boolean;
    stubNote?: string;
    oauth?: boolean;
  }
> = {
  homeassistant: {
    description:
      "Connect to a local Home Assistant instance via REST API and WebSocket.",
    fields: [
      {
        key: "url",
        label: "URL",
        type: "text",
        placeholder: "http://homeassistant.local:8123",
      },
      {
        key: "token",
        label: "Long-Lived Access Token",
        type: "password",
        placeholder: "Your HA token",
      },
    ],
  },
  homey: {
    description:
      "Connect to a Homey hub on your local network using the local API.",
    fields: [
      {
        key: "url",
        label: "URL",
        type: "text",
        placeholder: "http://homey.local",
      },
      {
        key: "token",
        label: "Local API Token",
        type: "password",
        placeholder: "From Homey app settings",
      },
    ],
  },
  homekit: {
    description: "Apple HomeKit direct integration.",
    stub: true,
    stubNote:
      "HomeKit direct integration requires HAP pairing. Use Home Assistant with the HomeKit Controller integration instead for the best experience.",
    fields: [
      {
        key: "host",
        label: "Controller Host",
        type: "text",
        placeholder: "192.168.1.x",
      },
      {
        key: "pin",
        label: "Pairing PIN",
        type: "text",
        placeholder: "123-45-678",
      },
    ],
  },
  google: {
    description:
      "Connect Nest devices (thermostat, camera, doorbell) via the Google Smart Device Management API.",
    fields: [
      {
        key: "projectId",
        label: "Device Access Project ID",
        type: "text",
        placeholder: "From console.nest.google.com/device-access",
      },
      {
        key: "clientId",
        label: "OAuth Client ID",
        type: "text",
        placeholder: "From Google Cloud Console",
      },
      {
        key: "clientSecret",
        label: "OAuth Client Secret",
        type: "password",
        placeholder: "From Google Cloud Console",
      },
    ],
    oauth: true,
  },
};

interface TestState {
  loading: boolean;
  result?: { ok: boolean; error?: string };
}

interface SyncState {
  loading: boolean;
  result?: { total: number; new: number };
  error?: string;
}

export default function IntegrationsView() {
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([]);
  const [formData, setFormData] = useState<
    Record<string, Record<string, string>>
  >({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [testState, setTestState] = useState<Record<string, TestState>>({});
  const [syncState, setSyncState] = useState<Record<string, SyncState>>({});
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  // Handle Google OAuth redirect-back query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("google_connected")) {
      setGoogleConnected(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("google_error")) {
      setGoogleError(decodeURIComponent(params.get("google_error") ?? ""));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const load = useCallback(async () => {
    const data = await api.integrations.list();
    setIntegrations(data);
    const initial: Record<string, Record<string, string>> = {};
    for (const intg of data) {
      initial[intg.id] = {};
      const meta = INTEGRATION_META[intg.id];
      if (meta) {
        for (const field of meta.fields) {
          initial[intg.id][field.key] =
            (intg.config[field.key] as string) || "";
        }
      }
    }
    setFormData(initial);
    // Check if Google already has a refresh token (previously authorised)
    const googleIntg = data.find((d) => d.id === "google");
    if (googleIntg?.config?.refreshToken) setGoogleConnected(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function setField(intgId: string, key: string, value: string) {
    setFormData((prev) => ({
      ...prev,
      [intgId]: { ...prev[intgId], [key]: value },
    }));
  }

  async function save(intgId: string) {
    setSaving((prev) => ({ ...prev, [intgId]: true }));
    await api.integrations.configure(intgId, formData[intgId] || {});
    setSaving((prev) => ({ ...prev, [intgId]: false }));
  }

  async function test(intgId: string) {
    setTestState((prev) => ({ ...prev, [intgId]: { loading: true } }));
    await save(intgId);
    const result = await api.integrations.test(intgId);
    setTestState((prev) => ({ ...prev, [intgId]: { loading: false, result } }));
  }

  async function sync(intgId: string) {
    setSyncState((prev) => ({ ...prev, [intgId]: { loading: true } }));
    try {
      const result = await api.integrations.sync(intgId);
      setSyncState((prev) => ({
        ...prev,
        [intgId]: { loading: false, result },
      }));
      load();
    } catch (e) {
      setSyncState((prev) => ({
        ...prev,
        [intgId]: { loading: false, error: (e as Error).message },
      }));
    }
  }

  async function toggle(intgId: string) {
    await api.integrations.toggle(intgId);
    load();
  }

  async function connectGoogle(intgId: string) {
    // Save credentials first so the server can use them during the OAuth flow
    await save(intgId);
    // Google OAuth requires a real domain or localhost — raw IPs are rejected.
    // Always use localhost here; the OAuth flow must be initiated from the
    // same machine running the HEARTH server. Use a Desktop app credential type.
    const redirectUri = `http://localhost:3010/api/integrations/google/callback`;
    try {
      const { url } = await api.integrations.googleAuthUrl(redirectUri);
      window.location.href = url;
    } catch (e) {
      setGoogleError((e as Error).message);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Integrations</div>
          <div className="page-subtitle">
            Connect HEARTH to your smart home platforms
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {integrations.map((intg) => {
          const meta = INTEGRATION_META[intg.id];
          if (!meta) return null;
          const tState = testState[intg.id];
          const sState = syncState[intg.id];
          const fields = formData[intg.id] || {};

          return (
            <div key={intg.id} className="card">
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  marginBottom: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
                      className={`status-dot ${intg.enabled ? "green" : "muted"}`}
                    />
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>
                        {intg.name}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-muted)",
                          marginTop: 2,
                        }}
                      >
                        {meta.description}
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexShrink: 0,
                  }}
                >
                  {intg.last_sync && (
                    <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                      Last sync: {new Date(intg.last_sync).toLocaleString()}
                    </span>
                  )}
                  <button
                    className={`btn btn-sm ${intg.enabled ? "btn-secondary" : "btn-primary"}`}
                    onClick={() => toggle(intg.id)}
                    disabled={meta.stub}
                  >
                    {intg.enabled ? "Disable" : "Enable"}
                  </button>
                </div>
              </div>

              {meta.stub && (
                <div
                  style={{
                    background: "var(--amber-dim)",
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    marginBottom: 16,
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                  }}
                >
                  <AlertTriangle
                    size={15}
                    color="var(--amber)"
                    style={{ flexShrink: 0, marginTop: 1 }}
                  />
                  <div style={{ fontSize: 12, color: "var(--amber)" }}>
                    {meta.stubNote}
                  </div>
                </div>
              )}

              {intg.id === "google" && !meta.stub && (
                <div style={{ marginBottom: 16 }}>
                  {googleConnected ? (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 13,
                        color: "var(--green)",
                        background: "rgba(34,197,94,0.08)",
                        border: "1px solid rgba(34,197,94,0.25)",
                        borderRadius: 6,
                        padding: "6px 12px",
                      }}
                    >
                      <CheckCircle size={13} />
                      Authorised with Google
                    </div>
                  ) : (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted)",
                        marginBottom: 8,
                      }}
                    >
                      Enter your credentials below, save, then connect your
                      Google account.
                    </div>
                  )}
                  {googleError && (
                    <div
                      style={{
                        marginTop: 8,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        color: "var(--red)",
                      }}
                    >
                      <XCircle size={13} />
                      {googleError}
                    </div>
                  )}
                </div>
              )}

              <div className="divider" style={{ margin: "0 0 16px" }} />

              <div className="grid-2" style={{ marginBottom: 16 }}>
                {meta.fields.map((field) => (
                  <div
                    className="form-group"
                    key={field.key}
                    style={{ marginBottom: 0 }}
                  >
                    <label className="form-label">{field.label}</label>
                    <input
                      className="form-input"
                      type={field.type}
                      placeholder={field.placeholder}
                      value={fields[field.key] || ""}
                      onChange={(e) =>
                        setField(intg.id, field.key, e.target.value)
                      }
                      disabled={meta.stub}
                    />
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => save(intg.id)}
                  disabled={saving[intg.id] || meta.stub}
                >
                  <Save size={13} />
                  {saving[intg.id] ? "Saving…" : "Save Config"}
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => test(intg.id)}
                  disabled={tState?.loading || meta.stub}
                >
                  {tState?.loading ? (
                    <RefreshCw size={13} className="pulse" />
                  ) : (
                    <CheckCircle size={13} />
                  )}
                  {tState?.loading ? "Testing…" : "Test Connection"}
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => sync(intg.id)}
                  disabled={sState?.loading || meta.stub}
                >
                  {sState?.loading ? (
                    <RefreshCw size={13} className="pulse" />
                  ) : (
                    <RefreshCw size={13} />
                  )}
                  {sState?.loading ? "Syncing…" : "Sync Devices"}
                </button>

                {meta.oauth && intg.id === "google" && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => connectGoogle(intg.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <LogIn size={13} />
                    {googleConnected
                      ? "Re-authorise Google"
                      : "Connect with Google"}
                  </button>
                )}

                {tState?.result && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 12,
                      color: tState.result.ok ? "var(--green)" : "var(--red)",
                    }}
                  >
                    {tState.result.ok ? (
                      <>
                        <CheckCircle size={13} /> Connected
                      </>
                    ) : (
                      <>
                        <XCircle size={13} /> {tState.result.error}
                      </>
                    )}
                  </span>
                )}

                {sState?.result && (
                  <span style={{ fontSize: 12, color: "var(--green)" }}>
                    <CheckCircle
                      size={13}
                      style={{ verticalAlign: "middle", marginRight: 4 }}
                    />
                    {sState.result.total} devices synced ({sState.result.new}{" "}
                    new)
                  </span>
                )}

                {sState?.error && (
                  <span style={{ fontSize: 12, color: "var(--red)" }}>
                    <XCircle
                      size={13}
                      style={{ verticalAlign: "middle", marginRight: 4 }}
                    />
                    {sState.error}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
