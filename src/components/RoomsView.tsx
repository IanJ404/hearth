import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import RoomCard from "./RoomCard";
import { api } from "../api";
import type { Room, Device, DeviceType } from "../types";

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
const DEVICE_TYPES: DeviceType[] = [
  "light",
  "switch",
  "thermostat",
  "sensor",
  "lock",
  "camera",
  "fan",
  "cover",
];

const EMPTY_ROOM_FORM = { name: "", icon: "home", color: "#6366f1" };

export default function RoomsView({ mergeDeviceState }: Props) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);

  // Room modal
  const [roomModal, setRoomModal] = useState<{
    mode: "create" | "edit";
    room?: Room;
  } | null>(null);
  const [roomForm, setRoomForm] = useState(EMPTY_ROOM_FORM);

  // Device edit modal
  const [deviceModal, setDeviceModal] = useState<Device | null>(null);
  const [deviceForm, setDeviceForm] = useState({
    name: "",
    type: "switch" as DeviceType,
    roomId: "",
  });

  // Delete confirms
  const [deleteRoom, setDeleteRoom] = useState<Room | null>(null);
  const [deleteDevice, setDeleteDevice] = useState<Device | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  // Room actions
  function openCreateRoom() {
    setRoomForm(EMPTY_ROOM_FORM);
    setRoomModal({ mode: "create" });
  }

  function openEditRoom(room: Room) {
    setRoomForm({ name: room.name, icon: room.icon, color: room.color });
    setRoomModal({ mode: "edit", room });
  }

  async function saveRoom() {
    if (!roomForm.name.trim()) return;
    try {
      if (roomModal?.mode === "create") {
        await api.rooms.create(roomForm);
      } else if (roomModal?.room) {
        await api.rooms.update(roomModal.room.id, roomForm);
      }
      setRoomModal(null);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function confirmDeleteRoom() {
    if (!deleteRoom) return;
    await api.rooms.delete(deleteRoom.id);
    setDeleteRoom(null);
    load();
  }

  // Device actions
  function openEditDevice(device: Device) {
    setDeviceForm({
      name: device.name,
      type: device.type,
      roomId: device.room_id ?? "",
    });
    setDeviceModal(device);
  }

  async function saveDevice() {
    if (!deviceModal || !deviceForm.name.trim()) return;
    try {
      await api.devices.update(deviceModal.id, {
        name: deviceForm.name,
        type: deviceForm.type,
        room_id: deviceForm.roomId || null,
      });
      setDeviceModal(null);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function confirmDeleteDevice() {
    if (!deleteDevice) return;
    await api.devices.delete(deleteDevice.id);
    setDeleteDevice(null);
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
        <button className="btn btn-primary" onClick={openCreateRoom}>
          <Plus size={15} /> Add Room
        </button>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 14px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--red)",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          {error}
          <button
            onClick={() => setError(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--red)",
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {rooms.map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            devices={devicesByRoom(room.id)}
            onDeviceStateChange={handleDeviceStateChange}
            onEditDevice={openEditDevice}
            onDeleteDevice={setDeleteDevice}
            onEditRoom={openEditRoom}
            onDeleteRoom={setDeleteRoom}
          />
        ))}
        {rooms.length === 0 && (
          <div className="empty-state">
            <div style={{ fontSize: 32 }}>🏠</div>
            <div>No rooms yet</div>
            <button className="btn btn-primary" onClick={openCreateRoom}>
              Add your first room
            </button>
          </div>
        )}
      </div>

      {/* Room create/edit modal */}
      {roomModal && (
        <div className="modal-overlay" onClick={() => setRoomModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
              {roomModal.mode === "create" ? "Add Room" : "Edit Room"}
            </div>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input
                className="form-input"
                placeholder="e.g. Living Room"
                value={roomForm.name}
                onChange={(e) =>
                  setRoomForm({ ...roomForm, name: e.target.value })
                }
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Icon</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {ICONS.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setRoomForm({ ...roomForm, icon })}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 7,
                      border: `1px solid ${roomForm.icon === icon ? "var(--accent)" : "var(--border)"}`,
                      background:
                        roomForm.icon === icon
                          ? "var(--accent-dim)"
                          : "transparent",
                      color:
                        roomForm.icon === icon
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
                    onClick={() => setRoomForm({ ...roomForm, color })}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: color,
                      border:
                        roomForm.color === color
                          ? "2px solid #fff"
                          : "2px solid transparent",
                      outline:
                        roomForm.color === color
                          ? `2px solid ${color}`
                          : "none",
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="form-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setRoomModal(null)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveRoom}>
                {roomModal.mode === "create" ? "Create Room" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Device edit modal */}
      {deviceModal && (
        <div className="modal-overlay" onClick={() => setDeviceModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Edit Device</div>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input
                className="form-input"
                value={deviceForm.name}
                onChange={(e) =>
                  setDeviceForm({ ...deviceForm, name: e.target.value })
                }
                autoFocus
              />
            </div>
            <div className="grid-2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Type</label>
                <select
                  className="form-input"
                  value={deviceForm.type}
                  onChange={(e) =>
                    setDeviceForm({
                      ...deviceForm,
                      type: e.target.value as DeviceType,
                    })
                  }
                >
                  {DEVICE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Room</label>
                <select
                  className="form-input"
                  value={deviceForm.roomId}
                  onChange={(e) =>
                    setDeviceForm({ ...deviceForm, roomId: e.target.value })
                  }
                >
                  <option value="">No room</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setDeviceModal(null)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveDevice}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete room confirm */}
      {deleteRoom && (
        <div className="modal-overlay" onClick={() => setDeleteRoom(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Delete Room</div>
            <p
              style={{
                fontSize: 14,
                color: "var(--text-muted)",
                marginBottom: 20,
              }}
            >
              Delete <strong>{deleteRoom.name}</strong>? Devices in this room
              will be unassigned.
            </p>
            <div className="form-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setDeleteRoom(null)}
              >
                Cancel
              </button>
              <button className="btn btn-danger" onClick={confirmDeleteRoom}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete device confirm */}
      {deleteDevice && (
        <div className="modal-overlay" onClick={() => setDeleteDevice(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Delete Device</div>
            <p
              style={{
                fontSize: 14,
                color: "var(--text-muted)",
                marginBottom: 20,
              }}
            >
              Delete <strong>{deleteDevice.name}</strong>? This cannot be
              undone.
            </p>
            <div className="form-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setDeleteDevice(null)}
              >
                Cancel
              </button>
              <button className="btn btn-danger" onClick={confirmDeleteDevice}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
