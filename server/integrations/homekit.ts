import type { Integration, ExternalDevice } from "./index.js";

export class HomeKitIntegration implements Integration {
  readonly id = "homekit";
  readonly name = "Apple HomeKit";

  configure(_config: Record<string, unknown>) {
    // config fields: pin (HomeKit pairing code), host (IP of HomeKit controller)
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    return {
      ok: false,
      error:
        "HomeKit direct integration not yet implemented — use Home Assistant with HomeKit integration",
    };
  }

  async syncDevices(): Promise<ExternalDevice[]> {
    throw new Error(
      "HomeKit direct integration not yet implemented — use Home Assistant with HomeKit integration",
    );
  }

  async setState(
    _externalId: string,
    _state: Record<string, unknown>,
  ): Promise<void> {
    throw new Error(
      "HomeKit direct integration not yet implemented — use Home Assistant with HomeKit integration",
    );
  }

  startRealtime(
    _onUpdate: (externalId: string, state: Record<string, unknown>) => void,
  ) {
    // TODO: Implement via HAP-nodejs or hap-controller-node
    // HomeKit uses Bluetooth/IP pairing with ed25519 keys — not trivial to implement directly
    // Recommended: connect Home Assistant with the HomeKit Controller integration instead
  }

  stopRealtime() {
    // no-op
  }
}
