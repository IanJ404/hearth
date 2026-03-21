import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, ToggleLeft, ToggleRight, Clock } from "lucide-react";
import { api } from "../api";
import type { Schedule, Device } from "../types";

function humanCron(expr: string): string {
  const presets: Record<string, string> = {
    "0 7 * * 1-5": "Weekdays at 7:00 AM",
    "0 8 * * 1-5": "Weekdays at 8:00 AM",
    "0 22 * * *": "Every day at 10:00 PM",
    "0 23 * * *": "Every day at 11:00 PM",
    "0 6 * * *": "Every day at 6:00 AM",
    "0 7 * * *": "Every day at 7:00 AM",
    "0 0 * * *": "Every day at midnight",
    "0 12 * * *": "Every day at noon",
    "0 7 * * 6,0": "Weekends at 7:00 AM",
    "0 9 * * 6,0": "Weekends at 9:00 AM",
    "0 */2 * * *": "Every 2 hours",
    "0 */4 * * *": "Every 4 hours",
  };
  return presets[expr] || expr;
}

function timeAgo(isoStr: string | null): string {
  if (!isoStr) return "Never";
  const diff = Date.now() - new Date(isoStr).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

const CRON_PRESETS = [
  { label: "Every day at 7 AM", value: "0 7 * * *" },
  { label: "Every day at 6 AM", value: "0 6 * * *" },
  { label: "Weekdays at 7 AM", value: "0 7 * * 1-5" },
  { label: "Weekdays at 8 AM", value: "0 8 * * 1-5" },
  { label: "Weekends at 9 AM", value: "0 9 * * 6,0" },
  { label: "Every day at 10 PM", value: "0 22 * * *" },
  { label: "Every day at 11 PM", value: "0 23 * * *" },
  { label: "Every 2 hours", value: "0 */2 * * *" },
  { label: "Every 4 hours", value: "0 */4 * * *" },
];

export default function SchedulesView() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    cron: "0 7 * * *",
    device_id: "",
    state_key: "on",
    state_value: "true",
  });

  const load = useCallback(async () => {
    const [s, d] = await Promise.all([
      api.schedules.list(),
      api.devices.list(),
    ]);
    setSchedules(s);
    setDevices(d);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(id: string) {
    await api.schedules.toggle(id);
    load();
  }

  async function del(id: string) {
    if (!confirm("Delete this schedule?")) return;
    await api.schedules.delete(id);
    load();
  }

  async function create() {
    if (!form.name.trim() || !form.cron.trim()) return;
    let stateValue: unknown = form.state_value;
    if (form.state_value === "true") stateValue = true;
    else if (form.state_value === "false") stateValue = false;
    else if (!isNaN(Number(form.state_value)))
      stateValue = Number(form.state_value);

    await api.schedules.create({
      name: form.name,
      cron: form.cron,
      action: {
        type: "device_state",
        device_id: form.device_id || undefined,
        state: { [form.state_key]: stateValue },
      },
    });
    setShowModal(false);
    setForm({
      name: "",
      cron: "0 7 * * *",
      device_id: "",
      state_key: "on",
      state_value: "true",
    });
    load();
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Schedules</div>
          <div className="page-subtitle">
            {schedules.filter((s) => s.enabled).length} active of{" "}
            {schedules.length} total
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={15} /> Add Schedule
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {schedules.length === 0 ? (
          <div className="empty-state">
            <Clock size={32} />
            <div>No schedules yet</div>
            <button
              className="btn btn-primary"
              onClick={() => setShowModal(true)}
            >
              Create your first schedule
            </button>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Schedule</th>
                <th>Action</th>
                <th>Last Run</th>
                <th>Status</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 500 }}>{s.name}</td>
                  <td>
                    <div style={{ fontSize: 13 }}>{humanCron(s.cron)}</div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-dim)",
                        fontFamily: "monospace",
                      }}
                    >
                      {s.cron}
                    </div>
                  </td>
                  <td>
                    {s.action.device_id ? (
                      <div style={{ fontSize: 12 }}>
                        {devices.find((d) => d.id === s.action.device_id)
                          ?.name || s.action.device_id}
                        <span
                          style={{ color: "var(--text-muted)", marginLeft: 4 }}
                        >
                          → {JSON.stringify(s.action.state)}
                        </span>
                      </div>
                    ) : (
                      <span
                        style={{ fontSize: 12, color: "var(--text-muted)" }}
                      >
                        {s.action.type}
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {timeAgo(s.last_run)}
                  </td>
                  <td>
                    <span
                      className={`badge ${s.enabled ? "badge-green" : "badge-muted"}`}
                    >
                      {s.enabled ? "Active" : "Paused"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        className="btn btn-icon btn-secondary"
                        title={s.enabled ? "Pause" : "Enable"}
                        onClick={() => toggle(s.id)}
                      >
                        {s.enabled ? (
                          <ToggleRight size={15} color="var(--green)" />
                        ) : (
                          <ToggleLeft size={15} />
                        )}
                      </button>
                      <button
                        className="btn btn-icon btn-secondary"
                        title="Delete"
                        onClick={() => del(s.id)}
                      >
                        <Trash2 size={14} color="var(--red)" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">New Schedule</div>

            <div className="form-group">
              <label className="form-label">Name</label>
              <input
                className="form-input"
                placeholder="e.g. Morning Lights"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Schedule Preset</label>
              <select
                className="form-input"
                value={form.cron}
                onChange={(e) => setForm({ ...form, cron: e.target.value })}
              >
                {CRON_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
                <option value="custom">Custom...</option>
              </select>
            </div>

            {!CRON_PRESETS.find((p) => p.value === form.cron) && (
              <div className="form-group">
                <label className="form-label">Cron Expression</label>
                <input
                  className="form-input"
                  placeholder="0 7 * * *"
                  value={form.cron}
                  onChange={(e) => setForm({ ...form, cron: e.target.value })}
                  style={{ fontFamily: "monospace" }}
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Device (optional)</label>
              <select
                className="form-input"
                value={form.device_id}
                onChange={(e) =>
                  setForm({ ...form, device_id: e.target.value })
                }
              >
                <option value="">— All devices —</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">State Key</label>
                <select
                  className="form-input"
                  value={form.state_key}
                  onChange={(e) =>
                    setForm({ ...form, state_key: e.target.value })
                  }
                >
                  <option value="on">on/off</option>
                  <option value="brightness">brightness</option>
                  <option value="target_temp">target temp</option>
                  <option value="locked">locked</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Value</label>
                <select
                  className="form-input"
                  value={form.state_value}
                  onChange={(e) =>
                    setForm({ ...form, state_value: e.target.value })
                  }
                >
                  {form.state_key === "on" && (
                    <>
                      <option value="true">On (true)</option>
                      <option value="false">Off (false)</option>
                    </>
                  )}
                  {form.state_key === "locked" && (
                    <>
                      <option value="true">Locked (true)</option>
                      <option value="false">Unlocked (false)</option>
                    </>
                  )}
                  {form.state_key === "brightness" && (
                    <>
                      <option value="100">100%</option>
                      <option value="80">80%</option>
                      <option value="50">50%</option>
                      <option value="30">30%</option>
                      <option value="10">10%</option>
                    </>
                  )}
                  {form.state_key === "target_temp" && (
                    <>
                      <option value="18">18°C</option>
                      <option value="20">20°C</option>
                      <option value="21">21°C</option>
                      <option value="22">22°C</option>
                      <option value="24">24°C</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="form-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={create}>
                Create Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
