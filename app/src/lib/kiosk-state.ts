/**
 * State kiosk dari heartbeat (§6.1, §9). Disimpan di memori proses.
 */
export interface KioskDeviceInfo {
  deviceId: string;
  label: string;
  kind: string;
}

export interface KioskHeartbeat {
  devices: KioskDeviceInfo[];
  activeScreen: string | null;
  cameraStatus: string;
  updatedAt: string;
}

const globalForKiosk = globalThis as unknown as {
  __happyClickKiosk?: KioskHeartbeat;
};

export function recordHeartbeat(input: Partial<KioskHeartbeat>): KioskHeartbeat {
  const previous = globalForKiosk.__happyClickKiosk;
  const next: KioskHeartbeat = {
    devices: input.devices ?? previous?.devices ?? [],
    activeScreen: input.activeScreen ?? previous?.activeScreen ?? null,
    // Jangan timpa status valid dengan UNKNOWN bila input tidak mengirim status (§6.1).
    cameraStatus: (input.cameraStatus && input.cameraStatus !== "UNKNOWN") 
      ? input.cameraStatus 
      : (previous?.cameraStatus ?? "UNKNOWN"),
    updatedAt: new Date().toISOString(),
  };
  globalForKiosk.__happyClickKiosk = next;
  return next;
}

export function getHeartbeat(): KioskHeartbeat | null {
  return globalForKiosk.__happyClickKiosk ?? null;
}

export function isKioskOnline(maxAgeMs = 10_000): boolean {
  const hb = getHeartbeat();
  if (!hb) return false;
  return Date.now() - new Date(hb.updatedAt).getTime() <= maxAgeMs;
}
