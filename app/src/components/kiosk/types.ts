/** Tipe kios di sisi klien (tanpa modul server). */
import type { FrameRow } from "@/lib/operator-types";

export type { FrameRow };

export interface KioskSlot {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface KioskPrintProfile {
  dpi: number;
  paper: string;
  widthIn: number;
  heightIn: number;
  fit: string;
}

export interface KioskPhotoRef {
  shotIndex: number;
  url: string;
  capturedAt: string;
}

export interface KioskFrameView {
  id: string;
  name: string;
  category: string;
  slotCount: number;
  canvasWidth: number;
  canvasHeight: number;
  slots: KioskSlot[];
  overlayUrl: string;
  print: KioskPrintProfile | null;
}

export interface KioskSessionView {
  id: string;
  frameId: string | null;
  frame: KioskFrameView | null;
  photoCount: number;
  photos: KioskPhotoRef[];
  retakeCountUsed: number;
  filterChosen: string;
  slotAssignments: { slotIndex: number; shotIndex: number }[] | null;
  hasFinal: boolean;
}

export interface KioskStatusView {
  id: string;
  code: string;
  status: string;
  totalAmount: number;
  packageStripsCount: number;
  paymentMethod: string | null;
  expiresAt: string;
  serverTime: string;
  session: KioskSessionView | null;
}

export interface KioskConfig {
  camera: { source: string; deviceLabel: string | null; deviceId: string | null; maxResolution: string };
  countdownSec: number;
  photoCount: number;
  retakeQuota: number;
  autoResetSec: number;
  idleCancelSec: number;
  paymentTimeoutSec: number;
  activePaper: string;
  filterByActivePaper: boolean;
  packages: { strips: number; price: number }[];
  splashVideoUrl: string | null;
  qrisImageUrl: string | null;
  serverTime: string;
}

export interface KioskDevice {
  deviceId: string;
  label: string;
  kind: string;
}
