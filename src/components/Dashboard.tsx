import { useState, useEffect, useCallback } from "react";
import {
  Home,
  Zap,
  CalendarClock,
  Activity,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { api } from "../api";
import type { Room, Device, HEvent, IntegrationConfig } from "../types";
import type { View } from "../App";

interface Props {
  onNavigate: (view: View) => void;
  mergeDeviceState: (device: Device) => Device;
}

function StatCard({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="card"
      style={{ display: "flex", alignItems: "center", gap: 16 }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 11,
          background: color + "22",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "var(--text)",
            lineHeight: 1.2,
          }}
        >
          {value}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</div>
        {sub && (
          <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

function eventIcon(type: string): { bg: string; color: string } {
  const map: Record<string, { bg: string; color: string }> = {
    device_change: { bg: "var(--accent-dim)", color: "var(--accent)" },
    schedule_run: { bg: "var(--green-dim)", color: "var(--green)" },
    integration_sync: { bg: "rgba(59,130,246,0.15)", color: "#3b82f6" },
    ai_action: { bg: "rgba(139,92,246,0.15)", color: "#8b5cf6" },
    error: { bg: "var(--red-dim)", color: "var(--red)" },
  };
  return map[type] || map.device_change;
}

function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default function Dashboard({ onNavigate, mergeDeviceState }: Props) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [events, setEvents] = useState<HEvent[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, d, e, i] = await Promise.all([
      api.rooms.list(),
      api.devices.list(),
      api.events.list(10),
      api.integrations.list(),
    ]);
    setRooms(r);
    setDevices(d);
    setEvents(e);
    setIntegrations(i);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const mergedDevices = devices.map(mergeDeviceState);
  const onlineDevices = mergedDevices.filter((d) => d.state.on).length;
  const activeSchedules = 0; // computed via schedules API if needed
  const todayEvents = events.filter((e) => {
    const d = new Date(e.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">Welcome back to HEARTH</div>
        </div>
        <button className="btn btn-secondary" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? "pulse" : ""} />
          Refresh
        </button>
      </div>

      <div className="grid-3" style={{ marginBottom: 24 }}>
        <StatCard
          label="Rooms"
          value={rooms.length}
          sub="configured"
          color="#6366f1"
          icon={<Home size={22} />}
        />
        <StatCard
          label="Devices"
          value={`${onlineDevices}/${mergedDevices.length}`}
          sub="currently on"
          color="#22c55e"
          icon={<Zap size={22} />}
        />
        <StatCard
          label="Events Today"
          value={todayEvents}
          sub="logged"
          color="#f59e0b"
          icon={<Activity size={22} />}
        />
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20 }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600 }}>Rooms Overview</div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigate("rooms")}
            >
              View all <ChevronRight size={13} />
            </button>
          </div>
          <div className="grid-3" style={{ gap: 12 }}>
            {rooms.map((room) => {
              const roomDevices = mergedDevices.filter(
                (d) => d.room_id === room.id,
              );
              const onCount = roomDevices.filter((d) => d.state.on).length;
              return (
                <div
                  key={room.id}
                  className="card card-sm"
                  style={{ cursor: "pointer" }}
                  onClick={() => onNavigate("rooms")}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: room.color + "22",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: room.color,
                        fontSize: 16,
                      }}
                    >
                      <Home size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {room.name}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {roomDevices.length} devices
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {roomDevices.slice(0, 6).map((d) => (
                      <span
                        key={d.id}
                        className={`status-dot ${d.state.on ? "green" : "muted"}`}
                        title={`${d.name}: ${d.state.on ? "on" : "off"}`}
                      />
                    ))}
                    {roomDevices.length === 0 && (
                      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                        No devices
                      </span>
                    )}
                  </div>
                  {onCount > 0 && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--green)",
                        marginTop: 6,
                      }}
                    >
                      {onCount} device{onCount !== 1 ? "s" : ""} on
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>Recent Events</div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => onNavigate("events")}
              >
                All <ChevronRight size={12} />
              </button>
            </div>
            <div style={{ padding: "4px 0" }}>
              {events.slice(0, 8).map((event) => {
                const { bg, color } = eventIcon(event.type);
                return (
                  <div
                    key={event.id}
                    className="timeline-item"
                    style={{ padding: "8px 14px", gap: 10 }}
                  >
                    <div
                      className="timeline-icon"
                      style={{
                        background: bg,
                        color,
                        width: 28,
                        height: 28,
                        borderRadius: 7,
                        flexShrink: 0,
                      }}
                    >
                      <Activity size={13} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {event.description}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
                        {timeAgo(event.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
              {events.length === 0 && (
                <div
                  style={{
                    padding: "14px",
                    fontSize: 12,
                    color: "var(--text-dim)",
                    textAlign: "center",
                  }}
                >
                  No events yet
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid var(--border)",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Integrations
            </div>
            <div
              style={{
                padding: "8px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {integrations.map((intg) => (
                <div
                  key={intg.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ fontSize: 12, color: "var(--text)" }}>
                    {intg.name}
                  </span>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span
                      className={`status-dot ${intg.enabled ? "green" : "muted"}`}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        color: intg.enabled
                          ? "var(--green)"
                          : "var(--text-dim)",
                      }}
                    >
                      {intg.enabled ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 20,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <CalendarClock size={14} color="var(--text-muted)" />
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {activeSchedules} active schedules ·
        </span>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onNavigate("ai")}
          style={{ fontSize: 12 }}
        >
          Ask AI Assistant
        </button>
      </div>
    </div>
  );
}
