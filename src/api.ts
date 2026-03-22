import type {
  Room,
  Device,
  Schedule,
  HEvent,
  IntegrationConfig,
  DiscoveredDevice,
  ChatMessage,
} from "./types";

const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  rooms: {
    list: () => request<Room[]>("/rooms"),
    create: (data: Partial<Room>) =>
      request<Room>("/rooms", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Room>) =>
      request<Room>(`/rooms/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/rooms/${id}`, { method: "DELETE" }),
  },

  devices: {
    list: (roomId?: string) =>
      request<Device[]>(`/devices${roomId ? `?room_id=${roomId}` : ""}`),
    get: (id: string) => request<Device>(`/devices/${id}`),
    create: (data: Partial<Device>) =>
      request<Device>("/devices", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Device>) =>
      request<Device>(`/devices/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/devices/${id}`, { method: "DELETE" }),
    setState: (id: string, state: Record<string, unknown>) =>
      request<Device>(`/devices/${id}/state`, {
        method: "POST",
        body: JSON.stringify(state),
      }),
  },

  schedules: {
    list: () => request<Schedule[]>("/schedules"),
    create: (data: Partial<Schedule>) =>
      request<Schedule>("/schedules", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Schedule>) =>
      request<Schedule>(`/schedules/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/schedules/${id}`, { method: "DELETE" }),
    toggle: (id: string) =>
      request<Schedule>(`/schedules/${id}/toggle`, { method: "POST" }),
  },

  events: {
    list: (limit = 50, type?: string) =>
      request<HEvent[]>(`/events?limit=${limit}${type ? `&type=${type}` : ""}`),
    clear: () => request<{ ok: boolean }>("/events", { method: "DELETE" }),
  },

  integrations: {
    list: () => request<IntegrationConfig[]>("/integrations"),
    configure: (id: string, config: Record<string, unknown>) =>
      request<{ ok: boolean }>(`/integrations/${id}/configure`, {
        method: "POST",
        body: JSON.stringify(config),
      }),
    test: (id: string) =>
      request<{ ok: boolean; error?: string }>(`/integrations/${id}/test`, {
        method: "POST",
      }),
    sync: (id: string) =>
      request<{ ok: boolean; total: number; new: number }>(
        `/integrations/${id}/sync`,
        { method: "POST" },
      ),
    toggle: (id: string) =>
      request<{ ok: boolean; enabled: number }>(`/integrations/${id}/toggle`, {
        method: "POST",
      }),
    googleAuthUrl: (redirectUri: string) =>
      request<{ url: string }>(
        `/integrations/google/auth-url?redirect_uri=${encodeURIComponent(redirectUri)}`,
      ),
  },

  discovery: {
    list: () => request<DiscoveredDevice[]>("/discovery"),
    scan: () =>
      request<{ ok: boolean; scanning: boolean; message: string }>(
        "/discovery/scan",
        { method: "POST" },
      ),
  },

  ai: {
    chat: (messages: ChatMessage[]): EventSource => {
      const url = new URL("/api/ai", window.location.origin);
      const es = new EventSource(url.toString());
      return es;
    },
    chatStream: async (
      messages: ChatMessage[],
      onChunk: (text: string) => void,
      onDone: () => void,
      onError: (err: string) => void,
    ) => {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });

      if (!res.ok || !res.body) {
        onError(`HTTP ${res.status}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              onDone();
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                onError(parsed.error);
                return;
              }
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) onChunk(content);
            } catch {
              // skip unparseable lines
            }
          }
        }
      }
      onDone();
    },
  },
};
