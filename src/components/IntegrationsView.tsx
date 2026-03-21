import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  Save,
  AlertTriangle,
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
    description: "Google Home integration.",
    stub: true,
    stubNote:
      "Google Home integration requires a Google Cloud project and OAuth2 flow. Use Home Assistant with the Google Home integration instead.",
    fields: [
      {
        key: "projectId",
        label: "Project ID",
        type: "text",
        placeholder: "your-gcp-project-id",
      },
      {
        key: "clientId",
        label: "Client ID",
        type: "text",
        placeholder: "OAuth2 client ID",
      },
      {
        key: "clientSecret",
        label: "Client Secret",
        type: "password",
        placeholder: "OAuth2 client secret",
      },
    ],
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
