import { Router } from "express";
import { getDb } from "../db.js";
import { v4 as uuidv4 } from "uuid";
import { getIntegration } from "../integrations/index.js";
import type { Server } from "socket.io";

let io: Server;

export function setDeviceSocketIo(socketIo: Server) {
  io = socketIo;
}

const router = Router();

interface DeviceRow {
  id: string;
  room_id: string;
  name: string;
  type: string;
  state: string;
  integration: string;
  external_id: string;
  icon: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

function parseDevice(d: DeviceRow) {
  return { ...d, state: JSON.parse(d.state || "{}") };
}

router.get("/", (req, res) => {
  const db = getDb();
  const { room_id } = req.query;
  let devices: DeviceRow[];
  if (room_id) {
    devices = db
      .prepare("SELECT * FROM devices WHERE room_id = ? ORDER BY name")
      .all(room_id) as DeviceRow[];
  } else {
    devices = db
      .prepare("SELECT * FROM devices ORDER BY name")
      .all() as DeviceRow[];
  }
  res.json(devices.map(parseDevice));
});

router.get("/:id", (req, res) => {
  const db = getDb();
  const device = db
    .prepare("SELECT * FROM devices WHERE id = ?")
    .get(req.params.id) as DeviceRow | undefined;
  if (!device) return res.status(404).json({ error: "Device not found" });
  res.json(parseDevice(device));
});

router.post("/", (req, res) => {
  const {
    room_id,
    name,
    type,
    state = {},
    integration = "manual",
    external_id,
    icon,
  } = req.body;
  if (!name || !type)
    return res.status(400).json({ error: "name and type are required" });
  const db = getDb();
  const id = uuidv4();
  db.prepare(
    `
    INSERT INTO devices (id, room_id, name, type, state, integration, external_id, icon)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    id,
    room_id,
    name,
    type,
    JSON.stringify(state),
    integration,
    external_id,
    icon,
  );
  const device = db
    .prepare("SELECT * FROM devices WHERE id = ?")
    .get(id) as DeviceRow;
  res.status(201).json(parseDevice(device));
});

router.put("/:id", (req, res) => {
  const db = getDb();
  const device = db
    .prepare("SELECT * FROM devices WHERE id = ?")
    .get(req.params.id) as DeviceRow | undefined;
  if (!device) return res.status(404).json({ error: "Device not found" });
  const { room_id, name, type, integration, external_id, icon, enabled } =
    req.body;
  db.prepare(
    `
    UPDATE devices SET
      room_id = COALESCE(?, room_id),
      name = COALESCE(?, name),
      type = COALESCE(?, type),
      integration = COALESCE(?, integration),
      external_id = COALESCE(?, external_id),
      icon = COALESCE(?, icon),
      enabled = COALESCE(?, enabled),
      updated_at = datetime('now')
    WHERE id = ?
  `,
  ).run(
    room_id,
    name,
    type,
    integration,
    external_id,
    icon,
    enabled,
    req.params.id,
  );
  const updated = db
    .prepare("SELECT * FROM devices WHERE id = ?")
    .get(req.params.id) as DeviceRow;
  res.json(parseDevice(updated));
});

router.delete("/:id", (req, res) => {
  const db = getDb();
  const result = db
    .prepare("DELETE FROM devices WHERE id = ?")
    .run(req.params.id);
  if (result.changes === 0)
    return res.status(404).json({ error: "Device not found" });
  res.json({ ok: true });
});

router.post("/:id/state", async (req, res) => {
  const db = getDb();
  const device = db
    .prepare("SELECT * FROM devices WHERE id = ?")
    .get(req.params.id) as DeviceRow | undefined;
  if (!device) return res.status(404).json({ error: "Device not found" });

  const currentState = JSON.parse(device.state || "{}");
  const newState = { ...currentState, ...req.body };

  db.prepare(
    "UPDATE devices SET state = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(JSON.stringify(newState), device.id);

  const eventId = uuidv4();
  db.prepare(
    "INSERT INTO events (id, type, description, device_id, metadata) VALUES (?, ?, ?, ?, ?)",
  ).run(
    eventId,
    "device_change",
    `${device.name} state updated`,
    device.id,
    JSON.stringify({ previous: currentState, next: newState }),
  );

  if (io) {
    io.emit("device:update", { deviceId: device.id, state: newState });
    const event = db.prepare("SELECT * FROM events WHERE id = ?").get(eventId);
    io.emit("event:new", { event });
  }

  if (
    device.integration &&
    device.integration !== "manual" &&
    device.external_id
  ) {
    const integration = getIntegration(device.integration);
    if (integration) {
      try {
        await integration.setState(device.external_id, req.body);
      } catch (err) {
        console.error(`Integration setState failed for ${device.id}:`, err);
      }
    }
  }

  const updated = db
    .prepare("SELECT * FROM devices WHERE id = ?")
    .get(device.id) as DeviceRow;
  res.json(parseDevice(updated));
});

export default router;
