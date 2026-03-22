import { Router } from "express";
import { runScan, getDiscovered } from "../discovery.js";

const router = Router();

let scanInProgress = false;

// GET /api/discovery — return already-discovered devices
router.get("/", (_req, res) => {
  res.json(getDiscovered());
});

// POST /api/discovery/scan — start a new scan (non-blocking)
router.post("/scan", (_req, res) => {
  if (scanInProgress) {
    return res.json({
      ok: true,
      scanning: true,
      message: "Scan already running",
    });
  }

  scanInProgress = true;
  runScan(10_000).then(() => {
    scanInProgress = false;
  });

  res.json({
    ok: true,
    scanning: true,
    message: "Scan started — devices will appear via socket",
  });
});

export default router;
