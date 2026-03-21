import { Router } from "express";
import { getDb } from "../db.js";

const router = Router();

interface EventRow {
  id: string;
  type: string;
  description: string;
  device_id: string | null;
  metadata: string;
  created_at: string;
}

function parseEvent(e: EventRow) {
  return { ...e, metadata: JSON.parse(e.metadata || "{}") };
}

router.get("/", (req, res) => {
  const db = getDb();
  const limit = parseInt((req.query.limit as string) || "50", 10);
  const type = req.query.type as string | undefined;
  let events: EventRow[];
  if (type) {
    events = db
      .prepare(
        "SELECT * FROM events WHERE type = ? ORDER BY created_at DESC LIMIT ?",
      )
      .all(type, limit) as EventRow[];
  } else {
    events = db
      .prepare("SELECT * FROM events ORDER BY created_at DESC LIMIT ?")
      .all(limit) as EventRow[];
  }
  res.json(events.map(parseEvent));
});

router.delete("/", (_req, res) => {
  const db = getDb();
  db.prepare("DELETE FROM events").run();
  res.json({ ok: true });
});

export default router;
