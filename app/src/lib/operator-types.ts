/**
 * Tipe yang dipakai bersama oleh API operator dan komponen klien.
 * Berkas ini TIDAK mengimpor modul server (prisma/sharp) agar aman di-bundle ke browser.
 */

export interface Slot {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PrintProfileConfig {
  dpi: number;
  paper: string;
  widthIn: number;
  heightIn: number;
  fit: "CONTAIN" | "COVER";
}

export type ProcessingStage = "FRAME" | "PHOTO" | "REVIEW" | "READY";

export interface QueueItem {
  id: string;
  code: string;
  status: string;
  totalAmount: number;
  packageStripsCount: number;
  paymentMethod: string | null;
  createdAt: string;
  paidAt: string | null;
  expiresAt: string;
  cancelReason: string | null;
  remainingMs: number | null;
  stage: ProcessingStage | null;
  sessionId: string | null;
  frameId: string | null;
  frameName: string | null;
  photoCount: number;
  hasFinal: boolean;
  stale: boolean;
}

export interface QueuePayload {
  active: QueueItem[];
  recent: QueueItem[];
  counts: { active: number; completed: number; cancelled: number };
}

export interface FrameRow {
  id: string;
  name: string;
  category: string;
  isRecommended: boolean;
  slotCount: number;
  slots: Slot[];
  print: PrintProfileConfig | null;
  canvasWidth: number;
  canvasHeight: number;
  overlayPath: string;
  thumbnailPath: string | null;
  isActive: boolean;
  sortOrder: number;
  formatLabel: string;
  overlayUrl: string;
  thumbnailUrl: string;
}

export interface KioskStatus {
  online: boolean;
  activeScreen: string | null;
  cameraStatus: string;
  devices: { deviceId: string; label: string; kind: string }[];
  updatedAt: string | null;
}

export interface OperatorStatus {
  kiosk: KioskStatus;
  event: {
    status: string;
    openedAt: string | null;
    lastActivityAt: string | null;
    maxHours: number;
  };
  tunnel: {
    mode: string;
    online: boolean;
    publicBaseUrl: string | null;
    detectedUrl: string | null;
  };
}

export interface RecapItem {
  id: string;
  code: string;
  status: string;
  totalAmount: number;
  packageStripsCount: number;
  paymentMethod: string | null;
  cancelReason: string | null;
  createdAt: string;
  paidAt: string | null;
  completedAt: string | null;
  sessionId: string | null;
  hasFinal: boolean;
}

export interface RecapByKey {
  key: string;
  count: number;
  amount: number;
}

export interface Recap {
  income: number;
  orders: number;
  byMethod: RecapByKey[];
  byPackage: RecapByKey[];
  totalPrints: number;
  cancelledBeforePaid: { total: number; TIMEOUT: number; KIOSK_IDLE: number; OPERATOR: number };
  voided: { count: number; amount: number };
  avgSessionMs: number | null;
  profitEstimate: number | null;
  costPerStrip: number | null;
  costFixed: number | null;
}

export interface RecapPayload {
  recap: Recap;
  items: RecapItem[];
}
