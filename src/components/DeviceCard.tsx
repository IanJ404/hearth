import {
  Lightbulb,
  Plug,
  Thermometer,
  Activity,
  Lock,
  Camera,
  Wind,
  DoorOpen,
  Droplets,
  Lamp,
} from "lucide-react";
import { api } from "../api";
import type { Device } from "../types";

interface Props {
  device: Device;
  onStateChange: (device: Device) => void;
}

function DeviceIcon({ type, icon }: { type: string; icon: string | null }) {
  const size = 16;
  const map: Record<string, React.ReactNode> = {
    lightbulb: <Lightbulb size={size} />,
    plug: <Plug size={size} />,
    thermometer: <Thermometer size={size} />,
    activity: <Activity size={size} />,
    lock: <Lock size={size} />,
    camera: <Camera size={size} />,
    wind: <Wind size={size} />,
    "door-open": <DoorOpen size={size} />,
    droplets: <Droplets size={size} />,
    lamp: <Lamp size={size} />,
  };
  const key = icon || type;
  return <>{map[key] || <Activity size={size} />}</>;
}

function integrationColor(integration: string): string {
  const colors: Record<string, string> = {
    homeassistant: "#18bcf2",
    homey: "#f97316",
    homekit: "#34d399",
    google: "#4285f4",
    manual: "var(--text-dim)",
  };
  return colors[integration] || "var(--text-dim)";
}

export default function DeviceCard({ device, onStateChange }: Props) {
  const state = device.state;

  async function toggle() {
    const on = !state.on;
    const updated = await api.devices.setState(device.id, { on });
    onStateChange(updated);
  }

  async function setBrightness(brightness: number) {
    const updated = await api.devices.setState(device.id, { brightness });
    onStateChange(updated);
  }

  async function setTargetTemp(target_temp: number) {
    const updated = await api.devices.setState(device.id, { target_temp });
    onStateChange(updated);
  }

  async function setLock(locked: boolean) {
    const updated = await api.devices.setState(device.id, { locked });
    onStateChange(updated);
  }

  async function setCover(action: "open" | "close" | "stop") {
    const position =
      action === "open"
        ? 100
        : action === "close"
          ? 0
          : (state.position as number);
    const updated = await api.devices.setState(device.id, {
      position,
      state:
        action === "stop" ? "stopped" : action === "open" ? "open" : "closed",
    });
    onStateChange(updated);
  }

  const isOn = state.on as boolean | undefined;
  const iconColor = isOn ? "var(--amber)" : "var(--text-dim)";

  return (
    <div
      style={{
        background: "var(--bg)",
        border: `1px solid ${isOn ? "var(--border-light)" : "var(--border)"}`,
        borderRadius: 10,
        padding: "12px 14px",
        transition: "border-color 0.2s",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: isOn ? "var(--amber-dim)" : "rgba(255,255,255,0.04)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: iconColor,
              flexShrink: 0,
            }}
          >
            <DeviceIcon type={device.type} icon={device.icon} />
          </div>
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text)",
                lineHeight: 1.2,
              }}
            >
              {device.name}
            </div>
            <div
              style={{
                fontSize: 10,
                color: integrationColor(device.integration),
                marginTop: 1,
              }}
            >
              {device.integration}
            </div>
          </div>
        </div>

        {(device.type === "light" ||
          device.type === "switch" ||
          device.type === "fan" ||
          device.type === "camera") && (
          <label className="toggle">
            <input type="checkbox" checked={!!isOn} onChange={toggle} />
            <span className="toggle-slider" />
          </label>
        )}

        {device.type === "lock" && (
          <button
            className={`btn btn-sm ${state.locked ? "btn-secondary" : "btn-danger"}`}
            onClick={() => setLock(!state.locked as boolean)}
            style={{ padding: "4px 10px", fontSize: 11 }}
          >
            <Lock size={11} />
            {state.locked ? "Locked" : "Unlocked"}
          </button>
        )}
      </div>

      {device.type === "light" &&
        isOn &&
        typeof state.brightness === "number" && (
          <div style={{ marginTop: 8 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
                color: "var(--text-muted)",
                marginBottom: 4,
              }}
            >
              <span>Brightness</span>
              <span>{state.brightness}%</span>
            </div>
            <input
              type="range"
              className="slider-input"
              min={1}
              max={100}
              value={state.brightness as number}
              onChange={(e) => setBrightness(Number(e.target.value))}
              onMouseUp={(e) =>
                setBrightness(Number((e.target as HTMLInputElement).value))
              }
            />
          </div>
        )}

      {device.type === "thermostat" && (
        <div style={{ marginTop: 6 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <span
                style={{ fontSize: 20, fontWeight: 600, color: "var(--text)" }}
              >
                {typeof state.current_temp === "number"
                  ? state.current_temp.toFixed(1)
                  : String(state.current_temp ?? "")}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                °C
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                className="btn btn-sm btn-secondary"
                style={{ padding: "2px 8px" }}
                onClick={() =>
                  setTargetTemp(
                    Math.max(10, (state.target_temp as number) - 0.5),
                  )
                }
              >
                −
              </button>
              <span
                style={{
                  fontSize: 13,
                  color: "var(--text-muted)",
                  minWidth: 40,
                  textAlign: "center",
                }}
              >
                {typeof state.target_temp === "number"
                  ? state.target_temp.toFixed(1)
                  : String(state.target_temp ?? "")}
                °
              </span>
              <button
                className="btn btn-sm btn-secondary"
                style={{ padding: "2px 8px" }}
                onClick={() =>
                  setTargetTemp(
                    Math.min(35, (state.target_temp as number) + 0.5),
                  )
                }
              >
                +
              </button>
            </div>
          </div>
          {!!state.mode && (
            <div
              style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}
            >
              Mode: {String(state.mode)}
            </div>
          )}
        </div>
      )}

      {device.type === "sensor" && (
        <div style={{ marginTop: 4 }}>
          <span style={{ fontSize: 20, fontWeight: 600, color: "var(--text)" }}>
            {String(state.value)}
          </span>
          <span
            style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 2 }}
          >
            {state.unit as string}
          </span>
          {typeof state.battery === "number" && (
            <div
              style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}
            >
              Battery: {state.battery}%
            </div>
          )}
        </div>
      )}

      {device.type === "cover" && (
        <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
          <button
            className="btn btn-sm btn-secondary"
            style={{ flex: 1 }}
            onClick={() => setCover("open")}
          >
            Open
          </button>
          <button
            className="btn btn-sm btn-secondary"
            style={{ flex: 1 }}
            onClick={() => setCover("stop")}
          >
            Stop
          </button>
          <button
            className="btn btn-sm btn-secondary"
            style={{ flex: 1 }}
            onClick={() => setCover("close")}
          >
            Close
          </button>
        </div>
      )}

      {device.type === "camera" && (
        <div style={{ marginTop: 4, fontSize: 11 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              color: state.recording ? "var(--red)" : "var(--text-muted)",
            }}
          >
            <span
              className={
                state.recording ? "status-dot red pulse" : "status-dot muted"
              }
            />
            {state.recording ? "Recording" : "Idle"}
          </span>
          {!!state.motion_detected && (
            <span style={{ marginLeft: 8, color: "var(--amber)" }}>
              Motion detected
            </span>
          )}
        </div>
      )}
    </div>
  );
}
