import { Router } from "express";
import { getDb } from "../db.js";
import { config } from "../config.js";

const router = Router();

interface DeviceRow {
  id: string;
  name: string;
  type: string;
  state: string;
  room_id: string;
}

interface RoomRow {
  id: string;
  name: string;
}

function buildSystemPrompt(): string {
  const db = getDb();
  const rooms = db
    .prepare("SELECT * FROM rooms ORDER BY sort_order")
    .all() as RoomRow[];
  const devices = db
    .prepare("SELECT * FROM devices WHERE enabled = 1")
    .all() as DeviceRow[];

  const roomMap = new Map(rooms.map((r) => [r.id, r.name]));

  const deviceSummary = devices
    .map((d) => {
      const state = JSON.parse(d.state || "{}");
      const roomName = roomMap.get(d.room_id) || "Unassigned";
      let stateStr = "";
      if ("on" in state) stateStr = state.on ? "on" : "off";
      if ("value" in state) stateStr = `${state.value}${state.unit || ""}`;
      if ("locked" in state) stateStr = state.locked ? "locked" : "unlocked";
      if ("current_temp" in state)
        stateStr = `${state.current_temp}°C (target: ${state.target_temp}°C)`;
      return `- ${d.name} (${d.type}) in ${roomName}: ${stateStr}`;
    })
    .join("\n");

  const roomList = rooms
    .map((r) => {
      const count = devices.filter((d) => d.room_id === r.id).length;
      return `- ${r.name} (${count} devices)`;
    })
    .join("\n");

  return `You are HEARTH, an intelligent home automation assistant. You have real-time knowledge of the home's current state.

Rooms:
${roomList}

Device states:
${deviceSummary}

You can answer questions about the home, suggest automations, explain device states, and help control devices. When the user asks to control a device, provide clear instructions but note that device control via chat is informational — actual control happens through the dashboard.

Keep responses concise and helpful. Use the room and device context above to give accurate, specific answers.`;
}

router.post("/", async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array is required" });
  }

  const systemPrompt = buildSystemPrompt();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const response = await fetch(`${config.lmStudioUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.lmStudioModel,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      res.write(
        `data: ${JSON.stringify({ error: `LM Studio error: ${response.status}` })}\n\n`,
      );
      res.end();
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          res.write(line + "\n\n");
        }
      }
    }
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
  }

  res.end();
});

export default router;
