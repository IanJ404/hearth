import type { Integration, ExternalDevice } from "./index.js";

export class GoogleHomeIntegration implements Integration {
  readonly id = "google";
  readonly name = "Google Home";

  configure(_config: Record<string, unknown>) {
    // config fields: projectId, clientId, clientSecret
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    return {
      ok: false,
      error:
        "Google Home integration not yet implemented — use Home Assistant with Google Home integration",
    };
  }

  async syncDevices(): Promise<ExternalDevice[]> {
    throw new Error(
      "Google Home integration not yet implemented — use Home Assistant with Google Home integration",
    );
  }

  async setState(
    _externalId: string,
    _state: Record<string, unknown>,
  ): Promise<void> {
    throw new Error(
      "Google Home integration not yet implemented — use Home Assistant with Google Home integration",
    );
  }

  startRealtime(
    _onUpdate: (externalId: string, state: Record<string, unknown>) => void,
  ) {
    // TODO: Implement via Google Smart Home Action local fulfillment API
    // Requires Google Cloud project, OAuth2 flow, and Device Access Console enrollment
    // Recommended: connect Home Assistant with the Google Home integration instead
  }

  stopRealtime() {
    // no-op
  }
}
