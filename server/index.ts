import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { config } from "./config.js";
import { getDb } from "./db.js";
import { initIntegrations } from "./integrations/index.js";
import { initScheduler } from "./scheduler.js";
import roomsRouter from "./routes/rooms.js";
import devicesRouter, { setDeviceSocketIo } from "./routes/devices.js";
import schedulesRouter from "./routes/schedules.js";
import eventsRouter from "./routes/events.js";
import integrationsRouter, {
  setIntegrationSocketIo,
} from "./routes/integrations.js";
import aiRouter from "./routes/ai.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

app.use("/api/rooms", roomsRouter);
app.use("/api/devices", devicesRouter);
app.use("/api/schedules", schedulesRouter);
app.use("/api/events", eventsRouter);
app.use("/api/integrations", integrationsRouter);
app.use("/api/ai", aiRouter);

app.get("/api/health", (_req, res) => {
  const db = getDb();
  const roomCount = (
    db.prepare("SELECT COUNT(*) as c FROM rooms").get() as { c: number }
  ).c;
  const deviceCount = (
    db.prepare("SELECT COUNT(*) as c FROM devices").get() as { c: number }
  ).c;
  res.json({ ok: true, rooms: roomCount, devices: deviceCount });
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

setDeviceSocketIo(io);
setIntegrationSocketIo(io);

getDb();
initIntegrations();
initScheduler(io);

httpServer.listen(config.port, "0.0.0.0", () => {
  console.log(`HEARTH server running on http://0.0.0.0:${config.port}`);
});
