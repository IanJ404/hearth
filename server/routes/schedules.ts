import { Router } from "express";
import { getDb } from "../db.js";
import { v4 as uuidv4 } from "uuid";
import { registerTask, unregisterTask } from "../scheduler.js";
import cron from "node-cron";

const router = Router();

interface ScheduleRow {
  id: string;
  name: string;
  cron: string;
  action: string;
  enabled: number;
  last_run: string | null;
  next_run: string | null;
  created_at: string;
}

function parseSchedule(s: ScheduleRow) {
  return { ...s, action: JSON.parse(s.action || "{}") };
}

router.get("/", (_req, res) => {
  const db = getDb();
  const schedules = db
    .prepare("SELECT * FROM schedules ORDER BY created_at DESC")
    .all() as ScheduleRow[];
  res.json(schedules.map(parseSchedule));
});

router.post("/", (req, res) => {
  const { name, cron: cronExpr, action } = req.body;
  if (!name || !cronExpr || !action) {
    return res
      .status(400)
      .json({ error: "name, cron, and action are required" });
  }
  if (!cron.validate(cronExpr)) {
    return res.status(400).json({ error: "Invalid cron expression" });
  }
  const db = getDb();
  const id = uuidv4();
  db.prepare(
    "INSERT INTO schedules (id, name, cron, action, enabled) VALUES (?, ?, ?, ?, 1)",
  ).run(id, name, cronExpr, JSON.stringify(action));
  const schedule = db
    .prepare("SELECT * FROM schedules WHERE id = ?")
    .get(id) as ScheduleRow;
  registerTask(schedule);
  res.status(201).json(parseSchedule(schedule));
});

router.put("/:id", (req, res) => {
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM schedules WHERE id = ?")
    .get(req.params.id) as ScheduleRow | undefined;
  if (!existing) return res.status(404).json({ error: "Schedule not found" });
  const { name, cron: cronExpr, action } = req.body;
  if (cronExpr && !cron.validate(cronExpr)) {
    return res.status(400).json({ error: "Invalid cron expression" });
  }
  db.prepare(
    `
    UPDATE schedules SET
      name = COALESCE(?, name),
      cron = COALESCE(?, cron),
      action = COALESCE(?, action)
    WHERE id = ?
  `,
  ).run(name, cronExpr, action ? JSON.stringify(action) : null, req.params.id);
  const updated = db
    .prepare("SELECT * FROM schedules WHERE id = ?")
    .get(req.params.id) as ScheduleRow;
  registerTask(updated);
  res.json(parseSchedule(updated));
});

router.delete("/:id", (req, res) => {
  const db = getDb();
  unregisterTask(req.params.id);
  const result = db
    .prepare("DELETE FROM schedules WHERE id = ?")
    .run(req.params.id);
  if (result.changes === 0)
    return res.status(404).json({ error: "Schedule not found" });
  res.json({ ok: true });
});

router.post("/:id/toggle", (req, res) => {
  const db = getDb();
  const schedule = db
    .prepare("SELECT * FROM schedules WHERE id = ?")
    .get(req.params.id) as ScheduleRow | undefined;
  if (!schedule) return res.status(404).json({ error: "Schedule not found" });
  const newEnabled = schedule.enabled ? 0 : 1;
  db.prepare("UPDATE schedules SET enabled = ? WHERE id = ?").run(
    newEnabled,
    req.params.id,
  );
  const updated = db
    .prepare("SELECT * FROM schedules WHERE id = ?")
    .get(req.params.id) as ScheduleRow;
  if (newEnabled) {
    registerTask(updated);
  } else {
    unregisterTask(req.params.id);
  }
  res.json(parseSchedule(updated));
});

export default router;
