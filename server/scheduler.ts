import cron from "node-cron";
import { getDb } from "./db.js";
import { v4 as uuidv4 } from "uuid";
import type { Server } from "socket.io";

interface ScheduleRow {
  id: string;
  name: string;
  cron: string;
  action: string;
  enabled: number;
}

interface DeviceRow {
  id: string;
  state: string;
}

const tasks: Map<string, cron.ScheduledTask> = new Map();
let io: Server;

export function initScheduler(socketIo: Server) {
  io = socketIo;
  loadSchedules();
}

function loadSchedules() {
  const db = getDb();
  const schedules = db
    .prepare("SELECT * FROM schedules WHERE enabled = 1")
    .all() as ScheduleRow[];
  for (const schedule of schedules) {
    registerTask(schedule);
  }
}

export function registerTask(schedule: ScheduleRow) {
  if (tasks.has(schedule.id)) {
    tasks.get(schedule.id)!.stop();
    tasks.delete(schedule.id);
  }

  if (!schedule.enabled || !cron.validate(schedule.cron)) return;

  const task = cron.schedule(schedule.cron, () => {
    runSchedule(schedule);
  });

  tasks.set(schedule.id, task);
}

export function unregisterTask(scheduleId: string) {
  const task = tasks.get(scheduleId);
  if (task) {
    task.stop();
    tasks.delete(scheduleId);
  }
}

function runSchedule(schedule: ScheduleRow) {
  const db = getDb();
  try {
    const action = JSON.parse(schedule.action);
    const now = new Date().toISOString();

    db.prepare("UPDATE schedules SET last_run = ? WHERE id = ?").run(
      now,
      schedule.id,
    );

    const eventId = uuidv4();
    db.prepare(
      "INSERT INTO events (id, type, description, metadata) VALUES (?, ?, ?, ?)",
    ).run(
      eventId,
      "schedule_run",
      `Schedule "${schedule.name}" executed`,
      JSON.stringify({ schedule_id: schedule.id, action }),
    );

    if (io) {
      const event = db
        .prepare("SELECT * FROM events WHERE id = ?")
        .get(eventId);
      io.emit("event:new", { event });
    }

    if (action.type === "device_state" && action.device_id) {
      const device = db
        .prepare("SELECT * FROM devices WHERE id = ?")
        .get(action.device_id) as DeviceRow | undefined;
      if (device) {
        const currentState = JSON.parse(device.state);
        const newState = { ...currentState, ...action.state };
        db.prepare(
          "UPDATE devices SET state = ?, updated_at = ? WHERE id = ?",
        ).run(
          JSON.stringify(newState),
          new Date().toISOString(),
          action.device_id,
        );
        if (io) {
          io.emit("device:update", {
            deviceId: action.device_id,
            state: newState,
          });
        }
      }
    }
  } catch (err) {
    console.error(`Schedule ${schedule.id} failed:`, err);
    const db2 = getDb();
    db2
      .prepare(
        "INSERT INTO events (id, type, description, metadata) VALUES (?, ?, ?, ?)",
      )
      .run(
        uuidv4(),
        "error",
        `Schedule "${schedule.name}" failed: ${(err as Error).message}`,
        JSON.stringify({ schedule_id: schedule.id }),
      );
  }
}
