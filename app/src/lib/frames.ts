export interface FrameSlot {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
}

export interface Frame {
  id: string;
  name: string;
  slug: string;
  description: string;
  canvasWidth: number;
  canvasHeight: number;
  slotCount: number;
  slotsConfig: FrameSlot[];
  overlayPath: string;
  thumbnailPath: string;
  previewColor: string;
  isActive: boolean;
}

export const DEFAULT_FRAMES: Frame[] = [
  {
    id: "frame_classic_duo",
    name: "Classic Duo",
    slug: "classic-duo",
    description: "Format 4R portrait (1200x1800) dengan 2 slot foto 10:7 bergaya Neo-Brutalism.",
    canvasWidth: 1200,
    canvasHeight: 1800,
    slotCount: 2,
    slotsConfig: [
      { x: 100, y: 100, w: 1000, h: 700, rotation: 0 },
      { x: 100, y: 850, w: 1000, h: 700, rotation: 0 },
    ],
    overlayPath: "/frames/classic-duo.svg",
    thumbnailPath: "/frames/classic-duo.svg",
    previewColor: "#FFDE00",
    isActive: true,
  },
];

export function getFrames(): Frame[] {
  return DEFAULT_FRAMES.filter((f) => f.isActive);
}

export function getFrameById(id: string): Frame | undefined {
  return DEFAULT_FRAMES.find((f) => f.id === id);
}

export function getFrameBySlug(slug: string): Frame | undefined {
  return DEFAULT_FRAMES.find((f) => f.slug === slug);
}
