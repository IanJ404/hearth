import { useState, useEffect, useCallback } from "react";
import {
  Wifi,
  Search,
  RefreshCw,
  Plus,
  Cpu,
  Camera,
  Thermometer,
  Lightbulb,
  Lock,
  Radio,
} from "lucide-react";
import { api } from "../api";
import type { DiscoveredDevice } from "../types";
import { getSocket } from "../socket";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  homekit: <Wifi size={16} />,
  cast: <Radio size={16} />,
  hue: <Lightbulb size={16} />,
  lifx: <Lightbulb size={16} />,
  sonos: <Radio size={16} />,
  homeassistant: <Cpu size={16} />,
  homey: <Cpu size={16} />,
  matter: <Wifi size={16} />,
  thermostat: <Thermometer size={16} />,
  camera: <Camera size={16} />,
  light: <Lightbulb size={16} />,
  lock: <Lock size={16} />,
  device: <Cpu size={16} />,
};

const TYPE_LABELS: Record<string, string> = {
  homekit: "HomeKit",
  cast: "Google Cast",
  hue: "Philips Hue",
  lifx: "LIFX",
  sonos: "Sonos",
  homeassistant: "Home Assistant",
  homey: "Homey",
  matter: "Matter",
  thermostat: "Thermostat",
  camera: "Camera",
  light: "Light",
  plug: "Smart Plug",
  lock: "Lock",
  sensor: "Sensor",
  device: "Device",
  http: "HTTP Service",
  smarthome: "Smart Home",
};

export default function DiscoveryView() {
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  const load = useCallback(async () => {
    const data = await api.discovery.list();
    setDevices(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const socket = getSocket();
    const handler = (device: DiscoveredDevice) => {
      setDevices((prev) => {
        const exists = prev.find((d) => d.id === device.id);
        if (exists) return prev;
        return [...prev, device];
      });
    };
    socket.on("discovery:device", handler);
    return () => {
      socket.off("discovery:device", handler);
    };
  }, []);

  async function startScan() {
    setScanning(true);
    setScanProgress(0);

    // Start progress animation immediately, before the API round-trip
    const start = Date.now();
    const duration = 10_000;
    const tick = setInterval(() => {
      const pct = Math.min(((Date.now() - start) / duration) * 100, 100);
      setScanProgress(pct);
      if (pct >= 100) {
        clearInterval(tick);
        setScanning(false);
      }
    }, 200);

    try {
      await api.discovery.scan();
    } catch {
      clearInterval(tick);
      setScanning(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">LAN Discovery</div>
          <div className="page-subtitle">
            Scan your local network for smart home devices
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={startScan}
          disabled={scanning}
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          {scanning ? (
            <RefreshCw size={15} className="pulse" />
          ) : (
            <Search size={15} />
          )}
          {scanning ? "Scanning…" : "Scan Network"}
        </button>
      </div>

      {scanning && (
        <div
          style={{
            marginBottom: 16,
            background: "var(--surface)",
            borderRadius: 8,
            padding: "12px 16px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              color: "var(--text-muted)",
              marginBottom: 8,
            }}
          >
            <span>Scanning mDNS and SSDP/UPnP…</span>
            <span>{Math.round(scanProgress)}%</span>
          </div>
          <div
            style={{
              height: 4,
              background: "var(--border)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${scanProgress}%`,
                background: "var(--accent)",
                borderRadius: 2,
                transition: "width 0.2s ease",
              }}
            />
          </div>
        </div>
      )}

      {devices.length === 0 && !scanning ? (
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: 48,
            color: "var(--text-muted)",
          }}
        >
          <Wifi size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
          <div style={{ fontSize: 14 }}>No devices discovered yet</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            Click Scan Network to search for smart home devices on your LAN
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 12,
          }}
        >
          {devices.map((device) => (
            <div
              key={device.id}
              className="card"
              style={{ padding: "14px 16px" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "var(--surface-raised)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--accent)",
                      flexShrink: 0,
                    }}
                  >
                    {TYPE_ICONS[device.type] ?? <Cpu size={16} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {device.name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {TYPE_LABELS[device.type] ?? device.type} &middot;{" "}
                      {device.protocol.toUpperCase()}
                    </div>
                  </div>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    flexShrink: 0,
                  }}
                  title="Add to HEARTH"
                  onClick={() => {
                    // TODO: open add-device modal pre-filled with discovery data
                    alert(`Add "${device.name}" — coming soon`);
                  }}
                >
                  <Plus size={13} />
                  Add
                </button>
              </div>
              <div
                style={{
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: "1px solid var(--border)",
                  fontSize: 11,
                  color: "var(--text-dim)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <span>
                  Host:{" "}
                  <span style={{ color: "var(--text-muted)" }}>
                    {device.host}
                    {device.port ? `:${device.port}` : ""}
                  </span>
                </span>
                {device.addresses && device.addresses.length > 0 && (
                  <span>
                    IP:{" "}
                    <span style={{ color: "var(--text-muted)" }}>
                      {device.addresses.slice(0, 2).join(", ")}
                    </span>
                  </span>
                )}
                {device.serviceType && (
                  <span>
                    Service:{" "}
                    <span style={{ color: "var(--text-muted)" }}>
                      {device.serviceType}
                    </span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
