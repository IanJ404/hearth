import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import RoomsView from "./components/RoomsView";
import SchedulesView from "./components/SchedulesView";
import EventsView from "./components/EventsView";
import IntegrationsView from "./components/IntegrationsView";
import AIAssistant from "./components/AIAssistant";
import DiscoveryView from "./components/DiscoveryView";
import { getSocket } from "./socket";
import type { Device } from "./types";

export type View =
  | "dashboard"
  | "rooms"
  | "schedules"
  | "events"
  | "integrations"
  | "discovery"
  | "ai";

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [deviceStates, setDeviceStates] = useState<
    Map<string, Record<string, unknown>>
  >(new Map());

  useEffect(() => {
    const socket = getSocket();
    socket.on(
      "device:update",
      ({
        deviceId,
        state,
      }: {
        deviceId: string;
        state: Record<string, unknown>;
      }) => {
        setDeviceStates((prev) => new Map(prev).set(deviceId, state));
      },
    );
    return () => {
      socket.off("device:update");
    };
  }, []);

  function mergeDeviceState(device: Device): Device {
    const liveState = deviceStates.get(device.id);
    if (!liveState) return device;
    return { ...device, state: { ...device.state, ...liveState } };
  }

  return (
    <div className="app">
      <Sidebar currentView={view} onNavigate={setView} />
      <div className="main-content">
        {view === "dashboard" && (
          <Dashboard onNavigate={setView} mergeDeviceState={mergeDeviceState} />
        )}
        {view === "rooms" && <RoomsView mergeDeviceState={mergeDeviceState} />}
        {view === "schedules" && <SchedulesView />}
        {view === "events" && <EventsView />}
        {view === "integrations" && <IntegrationsView />}
        {view === "discovery" && <DiscoveryView />}
        {view === "ai" && <AIAssistant />}
      </div>
    </div>
  );
}
