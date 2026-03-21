import { Router } from "express";
import { getDb } from "../db.js";
import { getIntegration, getAllIntegrations } from "../integrations/index.js";
import type { GoogleHomeIntegration } from "../integrations/google.js";
import { v4 as uuidv4 } from "uuid";
import type { Server } from "socket.io";

let io: Server;

export function setIntegrationSocketIo(socketIo: Server) {
  io = socketIo;
}

const router = Router();

interface ConfigRow {
  id: string;
  config: string;
  enabled: number;
  last_sync: string | null;
  updated_at: string;
}

function redactConfig(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const redacted = { ...config };
  if (redacted.token) redacted.token = "***";
  if (redacted.clientSecret) redacted.clientSecret = "***";
  return redacted;
}

router.get("/", (_req, res) => {
  const db = getDb();
  const configs = db
    .prepare("SELECT * FROM integration_config")
    .all() as ConfigRow[];
  const integrations = getAllIntegrations();

  const result = integrations.map((integration) => {
    const configRow = configs.find((c) => c.id === integration.id);
    const parsed = configRow ? JSON.parse(configRow.config || "{}") : {};
    return {
      id: integration.id,
      name: integration.name,
      enabled: configRow?.enabled || 0,
      last_sync: configRow?.last_sync || null,
      config: redactConfig(parsed),
    };
  });
  res.json(result);
});

router.post("/:id/configure", (req, res) => {
  const db = getDb();
  const integration = getIntegration(req.params.id);
  if (!integration)
    return res.status(404).json({ error: "Integration not found" });

  const existing = db
    .prepare("SELECT * FROM integration_config WHERE id = ?")
    .get(req.params.id) as ConfigRow;
  const currentConfig = JSON.parse(existing?.config || "{}");

  const newConfig = { ...currentConfig };
  for (const [key, value] of Object.entries(req.body)) {
    if (value !== "***") newConfig[key] = value;
  }

  db.prepare(
    `
    UPDATE integration_config SET config = ?, updated_at = datetime('now') WHERE id = ?
  `,
  ).run(JSON.stringify(newConfig), req.params.id);

  integration.configure(newConfig);

  res.json({ ok: true, config: redactConfig(newConfig) });
});

router.post("/:id/test", async (req, res) => {
  const db = getDb();
  const integration = getIntegration(req.params.id);
  if (!integration)
    return res.status(404).json({ error: "Integration not found" });

  const configRow = db
    .prepare("SELECT * FROM integration_config WHERE id = ?")
    .get(req.params.id) as ConfigRow;
  const config = JSON.parse(configRow?.config || "{}");
  integration.configure(config);

  const result = await integration.testConnection();
  res.json(result);
});

router.post("/:id/sync", async (req, res) => {
  const db = getDb();
  const integration = getIntegration(req.params.id);
  if (!integration)
    return res.status(404).json({ error: "Integration not found" });

  const configRow = db
    .prepare("SELECT * FROM integration_config WHERE id = ?")
    .get(req.params.id) as ConfigRow;
  const config = JSON.parse(configRow?.config || "{}");
  integration.configure(config);

  try {
    const externalDevices = await integration.syncDevices();

    let synced = 0;
    for (const ext of externalDevices) {
      const existing = db
        .prepare(
          "SELECT * FROM devices WHERE integration = ? AND external_id = ?",
        )
        .get(req.params.id, ext.externalId);
      if (existing) {
        db.prepare(
          "UPDATE devices SET state = ?, name = ?, updated_at = datetime('now') WHERE integration = ? AND external_id = ?",
        ).run(
          JSON.stringify(ext.state),
          ext.name,
          req.params.id,
          ext.externalId,
        );
      } else {
        db.prepare(
          `
          INSERT INTO devices (id, name, type, state, integration, external_id, icon, enabled)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `,
        ).run(
          uuidv4(),
          ext.name,
          ext.type,
          JSON.stringify(ext.state),
          req.params.id,
          ext.externalId,
          ext.icon || "zap",
        );
        synced++;
      }
    }

    db.prepare(
      "UPDATE integration_config SET last_sync = datetime('now') WHERE id = ?",
    ).run(req.params.id);

    const eventId = uuidv4();
    db.prepare(
      "INSERT INTO events (id, type, description, metadata) VALUES (?, ?, ?, ?)",
    ).run(
      eventId,
      "integration_sync",
      `${integration.name} sync: ${externalDevices.length} devices (${synced} new)`,
      JSON.stringify({
        integration: req.params.id,
        total: externalDevices.length,
        new: synced,
      }),
    );

    if (io) {
      io.emit("integration:sync", {
        integrationId: req.params.id,
        deviceCount: externalDevices.length,
      });
      const event = db
        .prepare("SELECT * FROM events WHERE id = ?")
        .get(eventId);
      io.emit("event:new", { event });
    }

    res.json({ ok: true, total: externalDevices.length, new: synced });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/:id/toggle", (req, res) => {
  const db = getDb();
  const integration = getIntegration(req.params.id);
  if (!integration)
    return res.status(404).json({ error: "Integration not found" });

  const configRow = db
    .prepare("SELECT * FROM integration_config WHERE id = ?")
    .get(req.params.id) as ConfigRow;
  const newEnabled = configRow.enabled ? 0 : 1;
  db.prepare("UPDATE integration_config SET enabled = ? WHERE id = ?").run(
    newEnabled,
    req.params.id,
  );

  if (newEnabled) {
    const config = JSON.parse(configRow.config || "{}");
    integration.configure(config);
    integration.startRealtime((externalId, state) => {
      const device = db
        .prepare(
          "SELECT * FROM devices WHERE integration = ? AND external_id = ?",
        )
        .get(req.params.id, externalId) as
        | { id: string; state: string }
        | undefined;
      if (device) {
        const current = JSON.parse(device.state || "{}");
        const next = { ...current, ...state };
        db.prepare("UPDATE devices SET state = ? WHERE id = ?").run(
          JSON.stringify(next),
          device.id,
        );
        if (io) io.emit("device:update", { deviceId: device.id, state: next });
      }
    });
  } else {
    integration.stopRealtime();
  }

  res.json({ ok: true, enabled: newEnabled });
});

// ── Google OAuth ──────────────────────────────────────────────────────────────

// Returns the Google authorization URL so the frontend can redirect the user
router.get("/google/auth-url", (req, res) => {
  const db = getDb();
  const integration = getIntegration("google") as
    | (GoogleHomeIntegration & { getAuthUrl: (r: string) => string })
    | undefined;
  if (!integration)
    return res.status(404).json({ error: "Google integration not found" });

  const configRow = db
    .prepare("SELECT config FROM integration_config WHERE id = 'google'")
    .get() as { config: string } | undefined;
  const config = JSON.parse(configRow?.config || "{}");
  integration.configure(config);

  const redirectUri = String(req.query.redirect_uri ?? "");
  if (!redirectUri)
    return res.status(400).json({ error: "redirect_uri required" });

  try {
    const url = integration.getAuthUrl(redirectUri);
    res.json({ url });
  } catch (err: unknown) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Google redirects here after the user grants consent
router.get("/google/callback", async (req, res) => {
  const db = getDb();
  const { code, error } = req.query as Record<string, string>;

  // Redirect back to the frontend after auth.
  // In dev the frontend is on 3011; in production the server serves the built app on 3010.
  const isDev = process.env.NODE_ENV !== "production";
  const frontendOrigin = isDev
    ? "http://localhost:3011"
    : "http://localhost:3010";

  if (error) {
    return res.redirect(
      `${frontendOrigin}?google_error=${encodeURIComponent(error)}`,
    );
  }
  if (!code) {
    return res.redirect(`${frontendOrigin}?google_error=no_code`);
  }

  const integration = getIntegration("google") as
    | (GoogleHomeIntegration & {
        exchangeCode: (
          code: string,
          redirectUri: string,
        ) => Promise<{
          accessToken: string;
          refreshToken: string;
          expiry: number;
        }>;
      })
    | undefined;
  if (!integration) {
    return res.redirect(`${frontendOrigin}?google_error=integration_missing`);
  }

  try {
    const redirectUri =
      "http://localhost:3010/api/integrations/google/callback";
    const configRow = db
      .prepare("SELECT config FROM integration_config WHERE id = 'google'")
      .get() as { config: string } | undefined;
    const config = JSON.parse(configRow?.config || "{}");
    integration.configure(config);

    const tokens = await integration.exchangeCode(code, redirectUri);

    // Persist tokens into the integration config
    const updated = {
      ...config,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiry: tokens.expiry,
    };
    db.prepare(
      "UPDATE integration_config SET config = ?, updated_at = datetime('now') WHERE id = 'google'",
    ).run(JSON.stringify(updated));
    integration.configure(updated);

    res.redirect(`${frontendOrigin}?google_connected=1`);
  } catch (err: unknown) {
    const msg = encodeURIComponent((err as Error).message);
    res.redirect(`${frontendOrigin}?google_error=${msg}`);
  }
});

export default router;
