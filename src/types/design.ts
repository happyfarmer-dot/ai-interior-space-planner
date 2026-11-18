export interface Point2D {
  x: number;
  y: number;
}

export type WorkflowStep = 1 | 2 | 3 | 4;

export type DesignMode = 'rearrange' | 'style' | 'place_object';

export type CanvasViewMode = 'perspective' | 'split' | 'floorplan';

export type ActiveCanvasTool =
  | 'select'
  | 'pan'
  | 'ruler'
  | 'brush_mask'
  | 'polygon_mask'
  | 'eraser'
  | 'material_pick'
  | 'manual_box_select';

export type ScalePreset =
  | 'door_210'
  | 'outlet_12'
  | 'a4_29_7'
  | 'tile_60'
  | 'custom';

export interface ScaleCalibration {
  calibrated: boolean;
  preset: ScalePreset;
  referenceCm: number;
  lineStart: Point2D; // normalized 0..1 relative to image dimensions
  lineEnd: Point2D; // normalized 0..1 relative to image dimensions
  pixelPerCm: number;
  showPerspectiveGrid: boolean;
  horizonY: number; // normalized 0..1
  vanishingX: number; // normalized 0..1
}

export type ProtectionCategory =
  | 'beam_column'
  | 'window'
  | 'ac_unit'
  | 'electrical_panel'
  | 'power_outlet';

export interface TopDownRectCm {
  x: number;
  y: number;
  w: number;
  d: number;
}

export interface ProtectionZone {
  id: string;
  category: ProtectionCategory;
  label: string;
  shape: 'brush' | 'polygon' | 'rect';
  points: Point2D[]; // normalized 0..1 in image coordinates
  strokeWidth?: number; // normalized relative to width, for brush
  topDownRectCm: TopDownRectCm;
  locked: boolean;
  autoDetected: boolean;
  clearanceCm?: number; // e.g., AC airflow clearance or breaker door clearance
}

export type FurnitureCategory =
  | 'sofa'
  | 'coffee_table'
  | 'tv_console'
  | 'bed'
  | 'wardrobe'
  | 'nightstand'
  | 'lounge_chair'
  | 'cat_tree'
  | 'storage_cabinet'
  | 'floor_lamp'
  | 'desk';

export interface FurnitureItem {
  id: string;
  name: string;
  category: FurnitureCategory;
  widthCm: number;
  depthCm: number;
  heightCm: number;
  topDownPosCm: {
    x: number; // top-left in room cm space
    y: number;
    rotationDeg: number; // 0, 90, 180, 270
  };
  imagePos: {
    x: number; // center normalized 0..1
    y: number; // baseline normalized 0..1
    scale: number;
  };
  bboxNorm: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  spriteUrl?: string;
  isOriginal: boolean;
  isPreserved: boolean;
  materialTag?: string;
  estimatedPriceTWD?: number;
  colorHex?: string;
}

export interface DoorSwingSpec {
  hingeCm: Point2D;
  radiusCm: number;
  startAngleDeg: number;
  endAngleDeg: number;
  label: string;
}

export interface RoomSurfacePolygons {
  floor: Point2D[];
  wall: Point2D[];
  sofa: Point2D[];
  curtain: Point2D[];
}

export interface RoomScene {
  id: string;
  name: string;
  description: string;
  sourceType: 'sample' | 'upload';
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  roomDimensionsCm: {
    width: number;
    depth: number;
    height: number;
  };
  areaPing: number; // 坪數
  windowSide: 'left' | 'right' | 'top';
  tvWallCenterCm: Point2D;
  doorSwing: DoorSwingSpec;
  surfacePolygons: RoomSurfacePolygons;
  defaultCalibration: ScaleCalibration;
  defaultProtectionZones: ProtectionZone[];
  defaultFurniture: FurnitureItem[];
  preRenderedStyles?: Record<string, string>;
}

export type StyleId =
  | 'nordic'
  | 'wabisabi'
  | 'minimalist'
  | 'industrial'
  | 'muji'
  | 'luxury';

export interface StyleDefinition {
  id: StyleId;
  nameZh: string;
  nameEn: string;
  tagline: string;
  palette: string[];
  recommendedFloorId: string;
  recommendedWallId: string;
  recommendedCurtainId: string;
  lutFilter: {
    brightness: number;
    contrast: number;
    saturate: number;
    sepia: number;
    hueRotateDeg: number;
    warmTintRgba: string;
  };
}

export interface StyleConfig {
  selectedStyleId: StyleId;
  intensity: number; // 0..100
  applied: boolean;
  renderedNote?: string;
}

export interface HighlightZone {
  id: string;
  label: string;
  reason: string;
  fitScore: number; // 0..100
  imageAnchor: Point2D; // normalized floor anchor
  perspectiveScale: number;
  topDownPosCm: {
    x: number;
    y: number;
    rotationDeg: number;
  };
  footprintPolyNorm: Point2D[];
  mepSafe: boolean;
}

export interface NewObjectConfig {
  itemName: string;
  sourceUrl: string | null;
  cutoutUrl: string | null;
  bgRemovalThreshold: number; // 10..80
  bgRemoved: boolean;
  widthCm: number;
  depthCm: number;
  heightCm: number;
  suggestedZones: HighlightZone[];
  selectedZoneId: string | null;
  placed: boolean;
}

export interface ParsedDesignConstraints {
  maxBudgetTWD: number | null;
  petFriendly: boolean;
  catTreeRequired: boolean;
  fengShuiMode?: boolean;
  preserveItems: string[];
  minWalkwayCm: number;
  requiredZones: string[];
  materialRestrictions: string[];
  storagePriority: 'low' | 'medium' | 'high';
  notes: string[];
}

export interface CustomDesignPrompt {
  selectedTags: string[];
  freeText: string;
  parsedJson: ParsedDesignConstraints;
  lastParsedAt: string | null;
}

export type TrafficLight = 'green' | 'yellow' | 'red';

export interface FengShuiCheckResult {
  ruleId: 'door_stove' | 'through_wind' | 'beam_over_bed' | 'mirror_facing_bed';
  title: string;
  status: TrafficLight;
  finding: string;
  remedy: string;
}

export interface ErgonomicsReport {
  mainWalkwayCm: number;
  walkwayStatus: TrafficLight;
  walkwaySegmentCm: [Point2D, Point2D];
  doorSwingClear: boolean;
  doorConflictItem: string | null;
  viewingDistanceCm: number;
  recommendedTvInches: string;
  tvDistanceStatus: TrafficLight;
  mepProtectionStatus: {
    lockedCount: number;
    conflictCount: number;
    conflicts: string[];
  };
  fengShuiChecks?: FengShuiCheckResult[];
  overallScore: number;
  summaryText: string;
}

export interface ConversationalEditMessage {
  id: string;
  instruction: string;
  createdAt: string;
  resultNote: string;
  fromCache?: boolean;
}

export interface RearrangementProposal {
  id: string;
  title: string;
  subtitle: string;
  score: number;
  tags: string[];
  rationale: string[];
  furnitureLayout: FurnitureItem[];
  ergonomics: ErgonomicsReport;
  aiRenderedImageUrl?: string | null;
  aiVisualPromptEn?: string;
}

export type SunPreset = 'east_morning' | 'west_afternoon' | 'north_soft' | 'night_mode';
export type KelvinTemp = 3000 | 4000 | 6000;

export interface LightingConfig {
  sunPreset: SunPreset;
  kelvin: KelvinTemp;
  recessedDownlights: boolean;
  indirectCoveLight: boolean;
  ambientBrightness: number; // 70..130
}

export type SurfaceTarget = 'floor' | 'wall' | 'sofa' | 'curtain';

export interface MaterialOption {
  id: string;
  target: SurfaceTarget;
  name: string;
  spec: string;
  swatchHex: string;
  patternType:
    | 'oak_plank'
    | 'herringbone_walnut'
    | 'microcement'
    | 'terrazzo'
    | 'matte_paint'
    | 'mineral_plaster'
    | 'sage_accent'
    | 'pet_linen'
    | 'cognac_leather'
    | 'boucle'
    | 'sheer_linen'
    | 'velvet_blackout';
  petFriendly: boolean;
  unitLabel: string; // e.g., '坪', '式', '窗'
  priceMinPerUnit: number;
  priceMaxPerUnit: number;
}

export interface MaterialOverrides {
  floor: string | null;
  wall: string | null;
  sofa: string | null;
  curtain: string | null;
  activeTarget: SurfaceTarget | null;
}

export type FurnitureBrand =
  | 'IKEA'
  | 'MUJI 無印良品'
  | 'NITORI 宜得利'
  | 'MR. LIVING 居家先生'
  | 'HOLA 和樂家居';

export interface CatalogProduct {
  id: string;
  brand: FurnitureBrand;
  sku: string;
  name: string;
  category: FurnitureCategory;
  widthCm: number;
  depthCm: number;
  heightCm: number;
  priceTWD: number;
  material: string;
  petScratchResistant: boolean;
  styleAffinity: StyleId[];
  colorHex: string;
  urlHint: string;
  searchUrl?: string;
}

export interface VisualSearchMatch {
  slotId: string;
  slotLabel: string;
  category?: FurnitureCategory;
  styleNote?: string;
  colorTone?: string;
  searchKeywordZh?: string;
  box2d?: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized 0..1000
  bboxNorm: { x: number; y: number; w: number; h: number };
  estimatedDimsCm: { w: number; d: number; h: number };
  matches: Array<{
    product: CatalogProduct;
    fitScore: number;
    dimDiffNote: string;
  }>;
}

export interface BomLineItem {
  id: string;
  category: '工程表面材' | '軟裝採購';
  name: string;
  spec: string;
  quantityLabel: string;
  unitPriceNote: string;
  minTotalTWD: number;
  maxTotalTWD: number;
  budgetSharePct: number;
}

export interface BomReport {
  items: BomLineItem[];
  surfaceMinTWD: number;
  surfaceMaxTWD: number;
  softMinTWD: number;
  softMaxTWD: number;
  grandMinTWD: number;
  grandMaxTWD: number;
  budgetCapTWD: number | null;
  overBudget: boolean;
  disclaimer: string;
}

export interface CoreDesignSnapshotState {
  currentStep: WorkflowStep;
  activeMode: DesignMode;
  viewMode: CanvasViewMode;
  scene: RoomScene;
  calibration: ScaleCalibration;
  protectionZones: ProtectionZone[];
  furniture: FurnitureItem[];
  proposals: RearrangementProposal[];
  selectedProposalId: string | null;
  styleConfig: StyleConfig;
  newObject: NewObjectConfig;
  customPrompt: CustomDesignPrompt;
  lighting: LightingConfig;
  materials: MaterialOverrides;
  aiRenderedImageUrl: string | null;
  aiRenderMode: DesignMode | 'refine' | null;
  aiRenderDescription: string | null;
}

export interface DesignVersionSnapshot {
  id: string;
  name: string;
  createdAt: string;
  summary: string;
  ergonomicsScore: number;
  estimatedMidTWD: number;
  state: CoreDesignSnapshotState;
}
