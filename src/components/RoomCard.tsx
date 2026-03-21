import { useState } from "react";
import {
  Sofa,
  Bed,
  ChefHat,
  Car,
  Home,
  Lightbulb,
  Thermometer,
  Shield,
} from "lucide-react";
import DeviceCard from "./DeviceCard";
import type { Room, Device } from "../types";

interface Props {
  room: Room;
  devices: Device[];
  onDeviceStateChange: (device: Device) => void;
}

function RoomIcon({ icon, color }: { icon: string; color: string }) {
  const size = 20;
  const map: Record<string, React.ReactNode> = {
    sofa: <Sofa size={size} />,
    bed: <Bed size={size} />,
    "cooking-pot": <ChefHat size={size} />,
    car: <Car size={size} />,
    home: <Home size={size} />,
    lightbulb: <Lightbulb size={size} />,
    thermometer: <Thermometer size={size} />,
    shield: <Shield size={size} />,
  };
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 9,
        background: color + "22",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color,
        flexShrink: 0,
      }}
    >
      {map[icon] || <Home size={size} />}
    </div>
  );
}

export default function RoomCard({
  room,
  devices,
  onDeviceStateChange,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const onCount = devices.filter((d) => d.state.on).length;

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 18px",
          cursor: "pointer",
          borderBottom: expanded ? "1px solid var(--border)" : "none",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <RoomIcon icon={room.icon} color={room.color} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{room.name}</div>
            <div
              style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}
            >
              {devices.length} device{devices.length !== 1 ? "s" : ""} ·{" "}
              {onCount} on
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {devices.slice(0, 4).map((d) => (
            <span
              key={d.id}
              className={`status-dot ${d.state.on ? "green" : "muted"}`}
              title={d.name}
            />
          ))}
          <span
            style={{
              color: "var(--text-dim)",
              fontSize: 18,
              marginLeft: 4,
              transform: expanded ? "rotate(90deg)" : "rotate(0)",
              transition: "transform 0.2s",
              display: "inline-block",
            }}
          >
            ›
          </span>
        </div>
      </div>

      {expanded && (
        <div
          style={{
            padding: "14px 16px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 10,
          }}
        >
          {devices.length === 0 ? (
            <div
              style={{
                color: "var(--text-dim)",
                fontSize: 13,
                padding: "8px 0",
                gridColumn: "1/-1",
              }}
            >
              No devices in this room
            </div>
          ) : (
            devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onStateChange={onDeviceStateChange}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
