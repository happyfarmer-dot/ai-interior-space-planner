import type {
  FurnitureItem,
  HighlightZone,
  LightingConfig,
  MaterialOverrides,
  ParsedDesignConstraints,
  ProtectionZone,
  RearrangementProposal,
  RoomScene,
  StyleId,
  VisualSearchMatch,
} from '../types/design';
import { buildAiCacheKey, getAiCacheEntry, setAiCacheEntry } from './aiCache';
import { getAIServiceConfig, getGeminiRuntimeConfig, hasGeminiApiKey } from './aiConfig';
import {
  analyzeObjectZonesWithGemini,
  analyzeUploadedRoomWithGemini,
  compositeNewObjectWithGemini,
  conversationalEditWithGemini,
  detectPurchasableItemsWithGemini,
  generateRearrangementPlanWithGemini,
  parseConstraintsWithGemini,
  refineLightingAndMaterialsWithGemini,
  renderRearrangedRoomImageWithGemini,
  renderStyleTransferWithGemini,
} from './geminiClient';
import { parseConstraintsMock } from './mockAiEngine';

export interface IAIPipelineService {
  readonly modeLabel: string;
  readonly isConfigured: boolean;
  analyzeUploadedRoom(params: {
    imageUrl: string;
    naturalWidth: number;
    naturalHeight: number;
    fallbackName?: string;
    signal?: AbortSignal;
  }): Promise<{
    sceneName: string;
    description: string;
    roomDimensionsCm: { width: number; depth: number; height: number };
    areaPing: number;
    windowSide: 'left' | 'right' | 'top';
    tvWallCenterCm: { x: number; y: number };
    doorSwing: RoomScene['doorSwing'];
    furniture: FurnitureItem[];
    protectionZones: ProtectionZone[];
    surfacePolygons: RoomScene['surfacePolygons'];
    fromCache?: boolean;
  }>;
  parseDesignConstraints(
    freeText: string,
    selectedTags: string[],
    options?: { allowLocalFallback?: boolean; fengShuiMode?: boolean; signal?: AbortSignal }
  ): Promise<ParsedDesignConstraints>;
  generateRearrangementProposals(
    scene: RoomScene,
    furniture: FurnitureItem[],
    protectionZones: ProtectionZone[],
    constraints: ParsedDesignConstraints,
    lighting: LightingConfig,
    signal?: AbortSignal
  ): Promise<RearrangementProposal[]>;
  renderRearrangedProposalImage(
    scene: RoomScene,
    proposal: RearrangementProposal,
    protectionZones: ProtectionZone[],
    constraints: ParsedDesignConstraints,
    lighting: LightingConfig,
    signal?: AbortSignal
  ): Promise<{ imageUrl: string; description: string; fromCache?: boolean }>;
  generateStyleTransferImage(params: {
    scene: RoomScene;
    styleId: StyleId;
    intensity: number;
    protectionZones: ProtectionZone[];
    constraints: ParsedDesignConstraints;
    lighting: LightingConfig;
    materials: MaterialOverrides;
    signal?: AbortSignal;
  }): Promise<{ imageUrl: string; description: string; fromCache?: boolean }>;
  analyzeObjectPlacementZones(
    scene: RoomScene,
    itemName: string,
    widthCm: number,
    depthCm: number,
    heightCm: number,
    protectionZones: ProtectionZone[],
    existingFurniture: FurnitureItem[],
    signal?: AbortSignal
  ): Promise<HighlightZone[]>;
  compositeNewObjectImage(params: {
    baseImageUrl: string;
    imageWidth: number;
    imageHeight: number;
    objectImageUrl: string;
    itemName: string;
    widthCm: number;
    depthCm: number;
    heightCm: number;
    zone: HighlightZone;
    constraints: ParsedDesignConstraints;
    lighting: LightingConfig;
    signal?: AbortSignal;
  }): Promise<{ imageUrl: string; description: string; fromCache?: boolean }>;
  refineLightingAndMaterials(params: {
    baseImageUrl: string;
    imageWidth: number;
    imageHeight: number;
    lighting: LightingConfig;
    materials: MaterialOverrides;
    protectionZones: ProtectionZone[];
    constraints: ParsedDesignConstraints;
    signal?: AbortSignal;
  }): Promise<{ imageUrl: string; description: string; fromCache?: boolean }>;
  conversationalEditImage(params: {
    baseImageUrl: string;
    imageWidth: number;
    imageHeight: number;
    instruction: string;
    history: string[];
    protectionZones: ProtectionZone[];
    lighting: LightingConfig;
    signal?: AbortSignal;
  }): Promise<{ imageUrl: string; description: string; fromCache?: boolean }>;
  detectPurchasableItems(params: {
    imageUrl: string;
    pixelPerCm: number;
    walkwayCm: number;
    roomDimensionsCm: { width: number; depth: number; height: number };
    activeStyle: StyleId;
    petFriendly: boolean;
    cropBoxNorm?: { x: number; y: number; w: number; h: number };
    forceRefresh?: boolean;
    signal?: AbortSignal;
  }): Promise<VisualSearchMatch[]>;
}

class GeminiInteriorAIService implements IAIPipelineService {
  get isConfigured(): boolean {
    return hasGeminiApiKey();
  }

  get modeLabel(): string {
    const cfg = getAIServiceConfig();
    return cfg.mode === 'live' ? `Gemini AI (${cfg.imageModel})` : '尚未設定 Gemini Key';
  }

  async analyzeUploadedRoom(params: {
    imageUrl: string;
    naturalWidth: number;
    naturalHeight: number;
    fallbackName?: string;
    signal?: AbortSignal;
  }) {
    const cfg = getGeminiRuntimeConfig();
    const cacheKey = await buildAiCacheKey('vlm_scene', params.imageUrl, {
      visionModel: cfg.visionModel,
      w: params.naturalWidth,
      h: params.naturalHeight,
    });
    const cached = getAiCacheEntry<Awaited<ReturnType<typeof analyzeUploadedRoomWithGemini>>>(cacheKey);
    if (cached) {
      return { ...cached, fromCache: true };
    }
    const res = await analyzeUploadedRoomWithGemini(params);
    setAiCacheEntry(cacheKey, res);
    return res;
  }

  async parseDesignConstraints(
    freeText: string,
    selectedTags: string[],
    options?: { allowLocalFallback?: boolean; fengShuiMode?: boolean; signal?: AbortSignal }
  ): Promise<ParsedDesignConstraints> {
    if (!hasGeminiApiKey() && options?.allowLocalFallback) {
      return parseConstraintsMock(freeText, selectedTags, Boolean(options?.fengShuiMode));
    }
    const cfg = getGeminiRuntimeConfig();
    const cacheKey = await buildAiCacheKey('parse_constraints', 'text_only', {
      visionModel: cfg.visionModel,
      freeText: freeText.trim(),
      selectedTags: [...selectedTags].sort(),
      fengShuiMode: Boolean(options?.fengShuiMode),
    });
    const cached = getAiCacheEntry<ParsedDesignConstraints>(cacheKey);
    if (cached) return cached;

    const res = await parseConstraintsWithGemini(freeText, selectedTags, {
      fengShuiMode: options?.fengShuiMode,
      signal: options?.signal,
    });
    setAiCacheEntry(cacheKey, res);
    return res;
  }

  async generateRearrangementProposals(
    scene: RoomScene,
    furniture: FurnitureItem[],
    protectionZones: ProtectionZone[],
    constraints: ParsedDesignConstraints,
    lighting: LightingConfig,
    signal?: AbortSignal
  ): Promise<RearrangementProposal[]> {
    const cfg = getGeminiRuntimeConfig();
    const cacheKey = await buildAiCacheKey('rearrange_proposals', scene.imageUrl, {
      visionModel: cfg.visionModel,
      imageModel: cfg.imageModel,
      furnitureIds: furniture.map((f) => `${f.id}:${f.widthCm}x${f.depthCm}`),
      lockedZones: protectionZones.filter((z) => z.locked).map((z) => z.category),
      minWalkwayCm: constraints.minWalkwayCm,
      petFriendly: constraints.petFriendly,
      fengShuiMode: Boolean(constraints.fengShuiMode),
      kelvin: lighting.kelvin,
    });
    const cached = getAiCacheEntry<RearrangementProposal[]>(cacheKey);
    if (cached) return cached;

    const res = await generateRearrangementPlanWithGemini({
      scene,
      furniture,
      protectionZones,
      constraints,
      lighting,
      signal,
    });
    setAiCacheEntry(cacheKey, res);
    return res;
  }

  async renderRearrangedProposalImage(
    scene: RoomScene,
    proposal: RearrangementProposal,
    protectionZones: ProtectionZone[],
    constraints: ParsedDesignConstraints,
    lighting: LightingConfig,
    signal?: AbortSignal
  ): Promise<{ imageUrl: string; description: string; fromCache?: boolean }> {
    const cfg = getGeminiRuntimeConfig();
    const cacheKey = await buildAiCacheKey('render_proposal', scene.imageUrl, {
      imageModel: cfg.imageModel,
      title: proposal.title,
      moves: proposal.furnitureLayout.map((f) => `${f.id}:${f.topDownPosCm.x},${f.topDownPosCm.y}`),
      kelvin: lighting.kelvin,
      fengShuiMode: Boolean(constraints.fengShuiMode),
    });
    const cached = getAiCacheEntry<{ imageUrl: string; description: string }>(cacheKey);
    if (cached) {
      return {
        imageUrl: cached.imageUrl,
        description: `${cached.description}（已讀取本地快取）`,
        fromCache: true,
      };
    }

    const res = await renderRearrangedRoomImageWithGemini({
      scene,
      proposal,
      protectionZones,
      constraints,
      lighting,
      signal,
    });
    setAiCacheEntry(cacheKey, res);
    return res;
  }

  async generateStyleTransferImage(params: {
    scene: RoomScene;
    styleId: StyleId;
    intensity: number;
    protectionZones: ProtectionZone[];
    constraints: ParsedDesignConstraints;
    lighting: LightingConfig;
    materials: MaterialOverrides;
    signal?: AbortSignal;
  }): Promise<{ imageUrl: string; description: string; fromCache?: boolean }> {
    const cfg = getGeminiRuntimeConfig();
    const cacheKey = await buildAiCacheKey('style_transfer', params.scene.imageUrl, {
      imageModel: cfg.imageModel,
      styleId: params.styleId,
      intensity: params.intensity,
      lockedZones: params.protectionZones.filter((z) => z.locked).map((z) => z.category),
      petFriendly: params.constraints.petFriendly,
      fengShuiMode: Boolean(params.constraints.fengShuiMode),
      kelvin: params.lighting.kelvin,
      sunPreset: params.lighting.sunPreset,
      floor: params.materials.floor,
      wall: params.materials.wall,
      sofa: params.materials.sofa,
      curtain: params.materials.curtain,
    });
    const cached = getAiCacheEntry<{ imageUrl: string; description: string }>(cacheKey);
    if (cached) {
      return {
        imageUrl: cached.imageUrl,
        description: `${cached.description}（已讀取本地快取）`,
        fromCache: true,
      };
    }

    const res = await renderStyleTransferWithGemini(params);
    setAiCacheEntry(cacheKey, res);
    return res;
  }

  async analyzeObjectPlacementZones(
    scene: RoomScene,
    itemName: string,
    widthCm: number,
    depthCm: number,
    heightCm: number,
    protectionZones: ProtectionZone[],
    existingFurniture: FurnitureItem[],
    signal?: AbortSignal
  ): Promise<HighlightZone[]> {
    const cfg = getGeminiRuntimeConfig();
    const cacheKey = await buildAiCacheKey('object_zones', scene.imageUrl, {
      visionModel: cfg.visionModel,
      itemName,
      widthCm,
      depthCm,
      heightCm,
      lockedCount: protectionZones.filter((z) => z.locked).length,
    });
    const cached = getAiCacheEntry<HighlightZone[]>(cacheKey);
    if (cached) return cached;

    const res = await analyzeObjectZonesWithGemini({
      scene,
      itemName,
      widthCm,
      depthCm,
      heightCm,
      protectionZones,
      existingFurniture,
      signal,
    });
    setAiCacheEntry(cacheKey, res);
    return res;
  }

  async compositeNewObjectImage(params: {
    baseImageUrl: string;
    imageWidth: number;
    imageHeight: number;
    objectImageUrl: string;
    itemName: string;
    widthCm: number;
    depthCm: number;
    heightCm: number;
    zone: HighlightZone;
    constraints: ParsedDesignConstraints;
    lighting: LightingConfig;
    signal?: AbortSignal;
  }): Promise<{ imageUrl: string; description: string; fromCache?: boolean }> {
    const cfg = getGeminiRuntimeConfig();
    const cacheKey = await buildAiCacheKey('composite_object', params.baseImageUrl, {
      imageModel: cfg.imageModel,
      itemName: params.itemName,
      w: params.widthCm,
      d: params.depthCm,
      h: params.heightCm,
      anchorX: params.zone.imageAnchor.x,
      anchorY: params.zone.imageAnchor.y,
      kelvin: params.lighting.kelvin,
    });
    const cached = getAiCacheEntry<{ imageUrl: string; description: string }>(cacheKey);
    if (cached) {
      return {
        imageUrl: cached.imageUrl,
        description: `${cached.description}（已讀取本地快取）`,
        fromCache: true,
      };
    }

    const res = await compositeNewObjectWithGemini(params);
    setAiCacheEntry(cacheKey, res);
    return res;
  }

  async refineLightingAndMaterials(params: {
    baseImageUrl: string;
    imageWidth: number;
    imageHeight: number;
    lighting: LightingConfig;
    materials: MaterialOverrides;
    protectionZones: ProtectionZone[];
    constraints: ParsedDesignConstraints;
    signal?: AbortSignal;
  }): Promise<{ imageUrl: string; description: string; fromCache?: boolean }> {
    const cfg = getGeminiRuntimeConfig();
    const cacheKey = await buildAiCacheKey('refine_light_mat', params.baseImageUrl, {
      imageModel: cfg.imageModel,
      sunPreset: params.lighting.sunPreset,
      kelvin: params.lighting.kelvin,
      recessed: params.lighting.recessedDownlights,
      cove: params.lighting.indirectCoveLight,
      floor: params.materials.floor,
      wall: params.materials.wall,
      sofa: params.materials.sofa,
      curtain: params.materials.curtain,
    });
    const cached = getAiCacheEntry<{ imageUrl: string; description: string }>(cacheKey);
    if (cached) {
      return {
        imageUrl: cached.imageUrl,
        description: `${cached.description}（已讀取本地快取）`,
        fromCache: true,
      };
    }

    const res = await refineLightingAndMaterialsWithGemini(params);
    setAiCacheEntry(cacheKey, res);
    return res;
  }

  async conversationalEditImage(params: {
    baseImageUrl: string;
    imageWidth: number;
    imageHeight: number;
    instruction: string;
    history: string[];
    protectionZones: ProtectionZone[];
    lighting: LightingConfig;
    signal?: AbortSignal;
  }): Promise<{ imageUrl: string; description: string; fromCache?: boolean }> {
    const cfg = getGeminiRuntimeConfig();
    const cacheKey = await buildAiCacheKey('chat_edit', params.baseImageUrl, {
      imageModel: cfg.imageModel,
      instruction: params.instruction.trim(),
      kelvin: params.lighting.kelvin,
    });
    const cached = getAiCacheEntry<{ imageUrl: string; description: string }>(cacheKey);
    if (cached) {
      return {
        imageUrl: cached.imageUrl,
        description: `${cached.description}（已讀取本地快取）`,
        fromCache: true,
      };
    }

    const res = await conversationalEditWithGemini(params);
    setAiCacheEntry(cacheKey, res);
    return res;
  }

  async detectPurchasableItems(params: {
    imageUrl: string;
    pixelPerCm: number;
    walkwayCm: number;
    roomDimensionsCm: { width: number; depth: number; height: number };
    activeStyle: StyleId;
    petFriendly: boolean;
    cropBoxNorm?: { x: number; y: number; w: number; h: number };
    forceRefresh?: boolean;
    signal?: AbortSignal;
  }): Promise<VisualSearchMatch[]> {
    const cfg = getGeminiRuntimeConfig();
    const cacheKey = await buildAiCacheKey('detect_purchasable', params.imageUrl, {
      visionModel: cfg.visionModel,
      pixelPerCm: params.pixelPerCm,
      walkwayCm: params.walkwayCm,
      roomW: params.roomDimensionsCm.width,
      roomD: params.roomDimensionsCm.depth,
      petFriendly: params.petFriendly,
      cropBoxNorm: params.cropBoxNorm ?? null,
    });
    if (!params.forceRefresh) {
      const cached = getAiCacheEntry<VisualSearchMatch[]>(cacheKey);
      if (cached) return cached;
    }

    const res = await detectPurchasableItemsWithGemini(params);
    setAiCacheEntry(cacheKey, res);
    return res;
  }
}

export const aiPipeline: IAIPipelineService = new GeminiInteriorAIService();
