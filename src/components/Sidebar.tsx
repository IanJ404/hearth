import {
  LayoutDashboard,
  DoorOpen,
  CalendarClock,
  Activity,
  Plug,
  BotMessageSquare,
  Flame,
} from "lucide-react";
import type { View } from "../App";

interface Props {
  currentView: View;
  onNavigate: (view: View) => void;
}

const NAV_ITEMS: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { id: "rooms", label: "Rooms", icon: <DoorOpen size={18} /> },
  { id: "schedules", label: "Schedules", icon: <CalendarClock size={18} /> },
  { id: "events", label: "Events", icon: <Activity size={18} /> },
  { id: "integrations", label: "Integrations", icon: <Plug size={18} /> },
  { id: "ai", label: "AI Assistant", icon: <BotMessageSquare size={18} /> },
];

export default function Sidebar({ currentView, onNavigate }: Props) {
  return (
    <aside
      style={{
        width: "var(--sidebar-width)",
        background: "var(--card)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        height: "100%",
      }}
    >
      <div
        style={{
          padding: "20px 20px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            background: "linear-gradient(135deg, #f59e0b, #ef4444)",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Flame size={18} color="#fff" />
        </div>
        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "0.05em",
              color: "var(--text)",
            }}
          >
            HEARTH
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              letterSpacing: "0.08em",
            }}
          >
            HOME HUB
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "12px 10px" }}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 12px",
              borderRadius: 8,
              marginBottom: 2,
              background:
                currentView === item.id ? "var(--accent-dim)" : "transparent",
              color:
                currentView === item.id ? "var(--accent)" : "var(--text-muted)",
              fontWeight: currentView === item.id ? 600 : 400,
              transition: "all 0.15s",
              textAlign: "left",
              fontSize: 13,
            }}
            onMouseEnter={(e) => {
              if (currentView !== item.id) {
                e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                e.currentTarget.style.color = "var(--text)";
              }
            }}
            onMouseLeave={(e) => {
              if (currentView !== item.id) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-muted)";
              }
            }}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid var(--border)",
          fontSize: 11,
          color: "var(--text-dim)",
        }}
      >
        v1.0.0 · Local Network
      </div>
    </aside>
  );
}
