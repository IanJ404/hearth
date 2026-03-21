import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = join(__dirname, "..", ".env");
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const eq = trimmed.indexOf("=");
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim();
          const val = trimmed.slice(eq + 1).trim();
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

export const config = {
  port: parseInt(process.env.PORT || "3010", 10),
  lmStudioUrl: process.env.LM_STUDIO_URL || "http://192.168.1.174:1234/v1",
  lmStudioModel: process.env.LM_STUDIO_MODEL || "local-model",
  dbPath: process.env.DB_PATH || "./hearth.db",
};
