import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import RoomCard from "./RoomCard";
import { api } from "../api";
import type { Room, Device } from "../types";

interface Props {
  mergeDeviceState: (device: Device) => Device;
}

const ICONS = [
  "home",
  "sofa",
  "bed",
  "cooking-pot",
  "car",
  "lightbulb",
  "thermometer",
  "shield",
];
const COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#f59e0b",
  "#22c55e",
  "#ef4444",
  "#3b82f6",
  "#6b7280",
  "#ec4899",
];

export default function RoomsView({ mergeDeviceState }: Props) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    icon: "home",
    color: "#6366f1",
  });

  const load = useCallback(async () => {
    const [r, d] = await Promise.all([api.rooms.list(), api.devices.list()]);
    setRooms(r);
    setDevices(d);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function devicesByRoom(roomId: string) {
    return devices.filter((d) => d.room_id === roomId).map(mergeDeviceState);
  }

  function handleDeviceStateChange(updated: Device) {
    setDevices((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  }

  async function createRoom() {
    if (!form.name.trim()) return;
    await api.rooms.create(form);
    setShowModal(false);
    setForm({ name: "", icon: "home", color: "#6366f1" });
    load();
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Rooms</div>
          <div className="page-subtitle">
            {rooms.length} rooms · {devices.length} devices
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={15} /> Add Room
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {rooms.map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            devices={devicesByRoom(room.id)}
            onDeviceStateChange={handleDeviceStateChange}
          />
        ))}
        {rooms.length === 0 && (
          <div className="empty-state">
            <div style={{ fontSize: 32 }}>🏠</div>
            <div>No rooms yet</div>
            <button
              className="btn btn-primary"
              onClick={() => setShowModal(true)}
            >
              Add your first room
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Add Room</div>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input
                className="form-input"
                placeholder="e.g. Living Room"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Icon</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {ICONS.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setForm({ ...form, icon })}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 7,
                      border: `1px solid ${form.icon === icon ? "var(--accent)" : "var(--border)"}`,
                      background:
                        form.icon === icon
                          ? "var(--accent-dim)"
                          : "transparent",
                      color:
                        form.icon === icon
                          ? "var(--accent)"
                          : "var(--text-muted)",
                      fontSize: 12,
                    }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Color</label>
              <div style={{ display: "flex", gap: 8 }}>
                {COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setForm({ ...form, color })}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: color,
                      border:
                        form.color === color
                          ? "2px solid #fff"
                          : "2px solid transparent",
                      outline:
                        form.color === color ? `2px solid ${color}` : "none",
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="form-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={createRoom}>
                Create Room
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
