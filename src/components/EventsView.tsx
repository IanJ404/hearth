import { useState, useEffect, useCallback } from "react";
import {
  Trash2,
  Zap,
  CalendarClock,
  Plug,
  BotMessageSquare,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { api } from "../api";
import { getSocket } from "../socket";
import type { HEvent, EventType } from "../types";

const TYPE_CONFIG: Record<
  EventType,
  { label: string; icon: React.ReactNode; bg: string; color: string }
> = {
  device_change: {
    label: "Device",
    icon: <Zap size={13} />,
    bg: "var(--accent-dim)",
    color: "var(--accent)",
  },
  schedule_run: {
    label: "Schedule",
    icon: <CalendarClock size={13} />,
    bg: "var(--green-dim)",
    color: "var(--green)",
  },
  integration_sync: {
    label: "Integration",
    icon: <Plug size={13} />,
    bg: "rgba(59,130,246,0.15)",
    color: "#3b82f6",
  },
  ai_action: {
    label: "AI",
    icon: <BotMessageSquare size={13} />,
    bg: "rgba(139,92,246,0.15)",
    color: "#8b5cf6",
  },
  error: {
    label: "Error",
    icon: <AlertTriangle size={13} />,
    bg: "var(--red-dim)",
    color: "var(--red)",
  },
};

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  return (
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
    " · " +
    d.toLocaleDateString([], { month: "short", day: "numeric" })
  );
}

export default function EventsView() {
  const [events, setEvents] = useState<HEvent[]>([]);
  const [filter, setFilter] = useState<EventType | "all">("all");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await api.events.list(
      100,
      filter === "all" ? undefined : filter,
    );
    setEvents(data);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const socket = getSocket();
    socket.on("event:new", ({ event }: { event: HEvent }) => {
      if (filter === "all" || event.type === filter) {
        setEvents((prev) => [event, ...prev].slice(0, 100));
      }
    });
    return () => {
      socket.off("event:new");
    };
  }, [filter]);

  async function clearAll() {
    if (!confirm("Clear all events?")) return;
    await api.events.clear();
    setEvents([]);
  }

  const filtered = events;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Events</div>
          <div className="page-subtitle">{events.length} events</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn-danger" onClick={clearAll}>
            <Trash2 size={14} /> Clear All
          </button>
        </div>
      </div>

      <div
        style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}
      >
        <button
          className={`btn btn-sm ${filter === "all" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setFilter("all")}
        >
          All
        </button>
        {(Object.keys(TYPE_CONFIG) as EventType[]).map((type) => (
          <button
            key={type}
            className={`btn btn-sm ${filter === type ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setFilter(type)}
          >
            {TYPE_CONFIG[type].label}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: "40px 20px" }}>
            <Zap size={28} />
            <div>
              No events {filter !== "all" ? `of type "${filter}"` : "yet"}
            </div>
          </div>
        ) : (
          <div>
            {filtered.map((event) => {
              const typeConf =
                TYPE_CONFIG[event.type] || TYPE_CONFIG.device_change;
              return (
                <div
                  key={event.id}
                  className="timeline-item fade-in"
                  style={{ padding: "12px 18px" }}
                >
                  <div
                    className="timeline-icon"
                    style={{
                      background: typeConf.bg,
                      color: typeConf.color,
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      flexShrink: 0,
                    }}
                  >
                    {typeConf.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 2,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          color: "var(--text)",
                          fontWeight: 500,
                        }}
                      >
                        {event.description}
                      </span>
                      <span
                        className={`badge badge-muted`}
                        style={{ fontSize: 10 }}
                      >
                        {typeConf.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                      {formatTime(event.created_at)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
