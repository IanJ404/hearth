import { Router } from "express";
import { getDb } from "../db.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();

router.get("/", (_req, res) => {
  const db = getDb();
  const rooms = db
    .prepare(
      `
    SELECT r.*, COUNT(d.id) as device_count
    FROM rooms r
    LEFT JOIN devices d ON d.room_id = r.id
    GROUP BY r.id
    ORDER BY r.sort_order, r.name
  `,
    )
    .all();
  res.json(rooms);
});

router.post("/", (req, res) => {
  const { name, icon = "home", color = "#6366f1", sort_order = 0 } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const db = getDb();
  const id = uuidv4();
  db.prepare(
    "INSERT INTO rooms (id, name, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)",
  ).run(id, name, icon, color, sort_order);
  const room = db.prepare("SELECT * FROM rooms WHERE id = ?").get(id);
  res.status(201).json(room);
});

router.put("/:id", (req, res) => {
  const db = getDb();
  const room = db
    .prepare("SELECT * FROM rooms WHERE id = ?")
    .get(req.params.id);
  if (!room) return res.status(404).json({ error: "Room not found" });
  const { name, icon, color, sort_order } = req.body;
  db.prepare(
    `
    UPDATE rooms SET
      name = COALESCE(?, name),
      icon = COALESCE(?, icon),
      color = COALESCE(?, color),
      sort_order = COALESCE(?, sort_order)
    WHERE id = ?
  `,
  ).run(name, icon, color, sort_order, req.params.id);
  res.json(db.prepare("SELECT * FROM rooms WHERE id = ?").get(req.params.id));
});

router.delete("/:id", (req, res) => {
  const db = getDb();
  const result = db
    .prepare("DELETE FROM rooms WHERE id = ?")
    .run(req.params.id);
  if (result.changes === 0)
    return res.status(404).json({ error: "Room not found" });
  res.json({ ok: true });
});

export default router;
