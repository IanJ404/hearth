import Database from "better-sqlite3";
import { config } from "./config.js";
import { v4 as uuidv4 } from "uuid";

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(config.dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema();
    seedData();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT DEFAULT 'home',
      color TEXT DEFAULT '#6366f1',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      state TEXT DEFAULT '{}',
      integration TEXT,
      external_id TEXT,
      icon TEXT,
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cron TEXT NOT NULL,
      action TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      last_run TEXT,
      next_run TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      device_id TEXT,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS integration_config (
      id TEXT PRIMARY KEY,
      config TEXT DEFAULT '{}',
      enabled INTEGER DEFAULT 0,
      last_sync TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const integrations = ["homeassistant", "homey", "homekit", "google"];
  const insertIntegration = db.prepare(
    `INSERT OR IGNORE INTO integration_config (id, config, enabled) VALUES (?, '{}', 0)`,
  );
  for (const id of integrations) {
    insertIntegration.run(id);
  }
}

function seedData() {
  const roomCount = (
    db.prepare("SELECT COUNT(*) as count FROM rooms").get() as { count: number }
  ).count;
  if (roomCount > 0) return;

  const rooms = [
    {
      id: uuidv4(),
      name: "Living Room",
      icon: "sofa",
      color: "#6366f1",
      sort_order: 0,
    },
    {
      id: uuidv4(),
      name: "Bedroom",
      icon: "bed",
      color: "#8b5cf6",
      sort_order: 1,
    },
    {
      id: uuidv4(),
      name: "Kitchen",
      icon: "cooking-pot",
      color: "#f59e0b",
      sort_order: 2,
    },
    {
      id: uuidv4(),
      name: "Garage",
      icon: "car",
      color: "#6b7280",
      sort_order: 3,
    },
  ];

  const insertRoom = db.prepare(
    "INSERT INTO rooms (id, name, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)",
  );
  for (const r of rooms) {
    insertRoom.run(r.id, r.name, r.icon, r.color, r.sort_order);
  }

  const devices = [
    // Living Room
    {
      id: uuidv4(),
      room_id: rooms[0].id,
      name: "Main Light",
      type: "light",
      state: JSON.stringify({ on: true, brightness: 80, color_temp: 4000 }),
      integration: "manual",
      icon: "lightbulb",
    },
    {
      id: uuidv4(),
      room_id: rooms[0].id,
      name: "TV Strip Light",
      type: "light",
      state: JSON.stringify({ on: false, brightness: 50, color_temp: 2700 }),
      integration: "manual",
      icon: "lightbulb",
    },
    {
      id: uuidv4(),
      room_id: rooms[0].id,
      name: "Air Conditioner",
      type: "thermostat",
      state: JSON.stringify({
        on: true,
        current_temp: 22.5,
        target_temp: 21,
        mode: "cool",
      }),
      integration: "manual",
      icon: "thermometer",
    },
    {
      id: uuidv4(),
      room_id: rooms[0].id,
      name: "Temperature Sensor",
      type: "sensor",
      state: JSON.stringify({ value: 22.5, unit: "°C", battery: 87 }),
      integration: "manual",
      icon: "thermometer",
    },
    // Bedroom
    {
      id: uuidv4(),
      room_id: rooms[1].id,
      name: "Ceiling Light",
      type: "light",
      state: JSON.stringify({ on: false, brightness: 60, color_temp: 2700 }),
      integration: "manual",
      icon: "lightbulb",
    },
    {
      id: uuidv4(),
      room_id: rooms[1].id,
      name: "Bedside Lamp",
      type: "light",
      state: JSON.stringify({ on: true, brightness: 30, color_temp: 2200 }),
      integration: "manual",
      icon: "lamp",
    },
    {
      id: uuidv4(),
      room_id: rooms[1].id,
      name: "Ceiling Fan",
      type: "fan",
      state: JSON.stringify({ on: true, speed: 2 }),
      integration: "manual",
      icon: "wind",
    },
    {
      id: uuidv4(),
      room_id: rooms[1].id,
      name: "Door Lock",
      type: "lock",
      state: JSON.stringify({ locked: true, battery: 92 }),
      integration: "manual",
      icon: "lock",
    },
    // Kitchen
    {
      id: uuidv4(),
      room_id: rooms[2].id,
      name: "Kitchen Light",
      type: "light",
      state: JSON.stringify({ on: true, brightness: 100, color_temp: 5000 }),
      integration: "manual",
      icon: "lightbulb",
    },
    {
      id: uuidv4(),
      room_id: rooms[2].id,
      name: "Dishwasher Switch",
      type: "switch",
      state: JSON.stringify({ on: false }),
      integration: "manual",
      icon: "plug",
    },
    {
      id: uuidv4(),
      room_id: rooms[2].id,
      name: "Humidity Sensor",
      type: "sensor",
      state: JSON.stringify({ value: 58, unit: "%", battery: 75 }),
      integration: "manual",
      icon: "droplets",
    },
    // Garage
    {
      id: uuidv4(),
      room_id: rooms[3].id,
      name: "Garage Door",
      type: "cover",
      state: JSON.stringify({ position: 0, state: "closed" }),
      integration: "manual",
      icon: "door-open",
    },
    {
      id: uuidv4(),
      room_id: rooms[3].id,
      name: "Garage Light",
      type: "light",
      state: JSON.stringify({ on: false, brightness: 100 }),
      integration: "manual",
      icon: "lightbulb",
    },
    {
      id: uuidv4(),
      room_id: rooms[3].id,
      name: "Security Camera",
      type: "camera",
      state: JSON.stringify({
        on: true,
        recording: true,
        motion_detected: false,
      }),
      integration: "manual",
      icon: "camera",
    },
  ];

  const insertDevice = db.prepare(`
    INSERT INTO devices (id, room_id, name, type, state, integration, icon)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const d of devices) {
    insertDevice.run(
      d.id,
      d.room_id,
      d.name,
      d.type,
      d.state,
      d.integration,
      d.icon,
    );
  }

  const schedules = [
    {
      id: uuidv4(),
      name: "Morning Lights",
      cron: "0 7 * * 1-5",
      action: JSON.stringify({
        type: "device_state",
        room_id: rooms[0].id,
        state: { on: true, brightness: 100 },
      }),
      enabled: 1,
    },
    {
      id: uuidv4(),
      name: "Night Mode",
      cron: "0 22 * * *",
      action: JSON.stringify({
        type: "device_state",
        room_id: null,
        state: { on: false },
      }),
      enabled: 1,
    },
  ];

  const insertSchedule = db.prepare(`
    INSERT INTO schedules (id, name, cron, action, enabled)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const s of schedules) {
    insertSchedule.run(s.id, s.name, s.cron, s.action, s.enabled);
  }

  const insertEvent = db.prepare(`
    INSERT INTO events (id, type, description, metadata)
    VALUES (?, ?, ?, ?)
  `);
  insertEvent.run(
    uuidv4(),
    "integration_sync",
    "HEARTH initialised with seed data",
    JSON.stringify({ seed: true }),
  );
}
