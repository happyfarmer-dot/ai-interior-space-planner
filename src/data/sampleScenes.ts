import type { ProtectionZone, RoomScene } from '../types/design';

export const EMPTY_ROOM_SCENE: RoomScene = {
  id: 'empty-room',
  name: '尚未匯入空間照片',
  description: '請透過相機拍攝或上傳室內現況照片，開始進行空間尺度校準與 AI 規劃。',
  sourceType: 'upload',
  imageUrl: '',
  imageWidth: 1280,
  imageHeight: 720,
  roomDimensionsCm: {
    width: 380,
    depth: 460,
    height: 280,
  },
  areaPing: 5.3,
  windowSide: 'left',
  tvWallCenterCm: { x: 25, y: 230 },
  doorSwing: {
    hingeCm: { x: 375, y: 450 },
    radiusCm: 88,
    startAngleDeg: 180,
    endAngleDeg: 270,
    label: '預估房門開啟半徑 (88cm)',
  },
  surfacePolygons: {
    floor: [
      { x: 0.2, y: 0.68 },
      { x: 0.8, y: 0.68 },
      { x: 0.96, y: 0.98 },
      { x: 0.04, y: 0.98 },
    ],
    wall: [
      { x: 0.15, y: 0.1 },
      { x: 0.85, y: 0.1 },
      { x: 0.85, y: 0.68 },
      { x: 0.15, y: 0.68 },
    ],
    sofa: [
      { x: 0.56, y: 0.54 },
      { x: 0.84, y: 0.58 },
      { x: 0.84, y: 0.86 },
      { x: 0.56, y: 0.8 },
    ],
    curtain: [
      { x: 0.03, y: 0.05 },
      { x: 0.16, y: 0.08 },
      { x: 0.16, y: 0.85 },
      { x: 0.03, y: 0.9 },
    ],
  },
  defaultCalibration: {
    calibrated: false,
    preset: 'door_210',
    referenceCm: 210,
    lineStart: { x: 0.85, y: 0.12 },
    lineEnd: { x: 0.85, y: 0.88 },
    pixelPerCm: 2.61,
    showPerspectiveGrid: false,
    horizonY: 0.45,
    vanishingX: 0.5,
  },
  defaultProtectionZones: [],
  defaultFurniture: [],
};

/**
 * Fallback heuristic structural & MEP zones used when user triggers
 * VLM auto-detection on a newly uploaded photograph.
 */
export const HEURISTIC_PROTECTION_ZONES: ProtectionZone[] = [
  {
    id: 'mep-auto-window',
    category: 'window',
    label: '側牆採光窗區（建議保留日照）',
    shape: 'rect',
    points: [
      { x: 0.05, y: 0.06 },
      { x: 0.26, y: 0.14 },
      { x: 0.26, y: 0.74 },
      { x: 0.05, y: 0.92 },
    ],
    topDownRectCm: { x: 0, y: 60, w: 30, d: 260 },
    locked: true,
    autoDetected: true,
    clearanceCm: 55,
  },
  {
    id: 'mep-auto-ac',
    category: 'ac_unit',
    label: '高處冷氣與迴風出風口',
    shape: 'rect',
    points: [
      { x: 0.36, y: 0.18 },
      { x: 0.52, y: 0.18 },
      { x: 0.52, y: 0.27 },
      { x: 0.36, y: 0.27 },
    ],
    topDownRectCm: { x: 75, y: 0, w: 95, d: 35 },
    locked: true,
    autoDetected: true,
    clearanceCm: 45,
  },
  {
    id: 'mep-auto-breaker',
    category: 'electrical_panel',
    label: '總配電箱／弱電檢修箱',
    shape: 'rect',
    points: [
      { x: 0.78, y: 0.26 },
      { x: 0.84, y: 0.26 },
      { x: 0.84, y: 0.44 },
      { x: 0.78, y: 0.44 },
    ],
    topDownRectCm: { x: 350, y: 310, w: 30, d: 45 },
    locked: true,
    autoDetected: true,
    clearanceCm: 60,
  },
  {
    id: 'mep-auto-beam',
    category: 'beam_column',
    label: '天花結構橫樑',
    shape: 'rect',
    points: [
      { x: 0.65, y: 0.02 },
      { x: 0.9, y: 0.02 },
      { x: 0.9, y: 0.14 },
      { x: 0.65, y: 0.14 },
    ],
    topDownRectCm: { x: 335, y: 0, w: 45, d: 460 },
    locked: true,
    autoDetected: true,
  },
];

export const SAMPLE_ADDON_ITEMS = [
  {
    id: 'addon-lounge-chair',
    name: '北歐白蠟木焦糖休閒單椅',
    category: 'lounge_chair' as const,
    imageUrl: './samples/item-lounge-chair.jpg',
    widthCm: 74,
    depthCm: 78,
    heightCm: 76,
    priceTWD: 12800,
  },
  {
    id: 'addon-cat-tree',
    name: '樺木極簡多層貓跳台',
    category: 'cat_tree' as const,
    imageUrl: './samples/item-cat-tree.jpg',
    widthCm: 60,
    depthCm: 55,
    heightCm: 145,
    priceTWD: 6490,
  },
];
