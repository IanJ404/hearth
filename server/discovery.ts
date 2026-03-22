// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Bonjour } = require("bonjour-service") as any;
import { Client as SsdpClient } from "node-ssdp";
import type { Server } from "socket.io";

export interface DiscoveredDevice {
  id: string;
  name: string;
  type: string;
  protocol: "mdns" | "ssdp";
  host: string;
  port?: number;
  addresses?: string[];
  txt?: Record<string, string | undefined>;
  serviceType?: string;
  udn?: string;
  seen: number; // timestamp
}

// mDNS service types to probe
const MDNS_SERVICES = [
  { type: "_hap._tcp", label: "homekit" },
  { type: "_googlecast._tcp", label: "cast" },
  { type: "_hue._tcp", label: "hue" },
  { type: "_lifx._tcp", label: "lifx" },
  { type: "_sonos._tcp", label: "sonos" },
  { type: "_home-assistant._tcp", label: "homeassistant" },
  { type: "_homey._tcp", label: "homey" },
  { type: "_http._tcp", label: "http" },
  { type: "_smarthome._tcp", label: "smarthome" },
  { type: "_matter._tcp", label: "matter" },
];

// SSDP search targets
const SSDP_TARGETS = [
  "ssdp:all",
  "urn:schemas-upnp-org:device:basic:1",
  "urn:Belkin-com:device:**",
];

let io: Server | null = null;
const discovered = new Map<string, DiscoveredDevice>();

export function setDiscoverySocketIo(socketIo: Server) {
  io = socketIo;
}

function emit(device: DiscoveredDevice) {
  discovered.set(device.id, device);
  if (io) io.emit("discovery:device", device);
}

function guessType(serviceType: string, name: string): string {
  const s = serviceType.toLowerCase();
  const n = name.toLowerCase();
  if (s.includes("hap") || n.includes("homekit")) return "homekit";
  if (
    s.includes("googlecast") ||
    n.includes("chromecast") ||
    n.includes("google home")
  )
    return "cast";
  if (s.includes("hue") || n.includes("hue")) return "hue";
  if (s.includes("lifx") || n.includes("lifx")) return "lifx";
  if (s.includes("sonos") || n.includes("sonos")) return "sonos";
  if (s.includes("home-assistant") || n.includes("home assistant"))
    return "homeassistant";
  if (s.includes("homey") || n.includes("homey")) return "homey";
  if (s.includes("matter")) return "matter";
  if (n.includes("nest") || n.includes("thermostat")) return "thermostat";
  if (n.includes("camera") || n.includes("cam")) return "camera";
  if (n.includes("light") || n.includes("bulb") || n.includes("lamp"))
    return "light";
  if (n.includes("plug") || n.includes("socket") || n.includes("outlet"))
    return "plug";
  if (n.includes("lock")) return "lock";
  if (n.includes("sensor")) return "sensor";
  return "device";
}

export function runScan(durationMs = 10_000): Promise<DiscoveredDevice[]> {
  return new Promise((resolve) => {
    const bonjour = new Bonjour();
    const ssdp = new SsdpClient();
    const scanResults = new Map<string, DiscoveredDevice>();

    function addDevice(device: DiscoveredDevice) {
      scanResults.set(device.id, device);
      emit(device);
    }

    // mDNS browsing
    const browsers = MDNS_SERVICES.map(({ type, label }) => {
      const browser = bonjour.find({
        type: type.replace("._tcp", "").replace("_", ""),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      browser.on("up", (service: any) => {
        const id = `mdns:${service.host}:${service.port ?? 0}:${label}`;
        const device: DiscoveredDevice = {
          id,
          name: service.name || service.host,
          type: guessType(type, service.name || ""),
          protocol: "mdns",
          host: service.host,
          port: service.port,
          addresses: service.addresses ?? [],
          txt: service.txt as Record<string, string | undefined>,
          serviceType: type,
          seen: Date.now(),
        };
        addDevice(device);
      });
      return browser;
    });

    // SSDP/UPnP scanning
    ssdp.on("response", (headers, _statusCode, rinfo) => {
      const udn =
        (headers as Record<string, string>)["USN"] ||
        (headers as Record<string, string>)["usn"] ||
        rinfo.address;
      const id = `ssdp:${udn}`;
      if (scanResults.has(id)) return;
      const server = (headers as Record<string, string>)["SERVER"] || "";
      const name =
        server
          .split(" ")
          .find((p) => !p.startsWith("UPnP") && !p.match(/^\d/)) ||
        rinfo.address;
      const device: DiscoveredDevice = {
        id,
        name,
        type: guessType(server, name),
        protocol: "ssdp",
        host: rinfo.address,
        serviceType: (headers as Record<string, string>)["ST"] || "upnp",
        udn,
        seen: Date.now(),
      };
      addDevice(device);
    });

    for (const target of SSDP_TARGETS) {
      try {
        const result = ssdp.search(target);
        if (result && typeof (result as Promise<void>).catch === "function") {
          (result as Promise<void>).catch(() => {});
        }
      } catch {}
    }

    setTimeout(() => {
      bonjour.destroy();
      ssdp.stop();
      for (const browser of browsers) {
        try {
          browser.stop();
        } catch {}
      }
      resolve(Array.from(scanResults.values()));
    }, durationMs);
  });
}

export function getDiscovered(): DiscoveredDevice[] {
  return Array.from(discovered.values());
}
