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
import { getAIServiceConfig, hasGeminiApiKey } from './aiConfig';
import {
  analyzeObjectZonesWithGemini,
  analyzeUploadedRoomWithGemini,
  compositeNewObjectWithGemini,
  generateRearrangementPlanWithGemini,
  parseConstraintsWithGemini,
  renderRearrangedRoomImageWithGemini,
  renderStyleTransferWithGemini,
  refineLightingAndMaterialsWithGemini,
} from './geminiClient';
import { parseConstraintsMock, visualSearchMock } from './mockAiEngine';

export interface IAIPipelineService {
  readonly modeLabel: string;
  readonly isConfigured: boolean;
  analyzeUploadedRoom(params: {
    imageUrl: string;
    naturalWidth: number;
    naturalHeight: number;
    fallbackName?: string;
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
  }>;
  parseDesignConstraints(
    freeText: string,
    selectedTags: string[],
    options?: { allowLocalFallback?: boolean }
  ): Promise<ParsedDesignConstraints>;
  generateRearrangementProposals(
    scene: RoomScene,
    furniture: FurnitureItem[],
    protectionZones: ProtectionZone[],
    constraints: ParsedDesignConstraints,
    lighting: LightingConfig
  ): Promise<RearrangementProposal[]>;
  renderRearrangedProposalImage(
    scene: RoomScene,
    proposal: RearrangementProposal,
    protectionZones: ProtectionZone[],
    constraints: ParsedDesignConstraints,
    lighting: LightingConfig
  ): Promise<{ imageUrl: string; description: string }>;
  generateStyleTransferImage(params: {
    scene: RoomScene;
    styleId: StyleId;
    intensity: number;
    protectionZones: ProtectionZone[];
    constraints: ParsedDesignConstraints;
    lighting: LightingConfig;
    materials: MaterialOverrides;
  }): Promise<{ imageUrl: string; description: string }>;
  analyzeObjectPlacementZones(
    scene: RoomScene,
    itemName: string,
    widthCm: number,
    depthCm: number,
    heightCm: number,
    protectionZones: ProtectionZone[],
    existingFurniture: FurnitureItem[]
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
  }): Promise<{ imageUrl: string; description: string }>;
  refineLightingAndMaterials(params: {
    baseImageUrl: string;
    imageWidth: number;
    imageHeight: number;
    lighting: LightingConfig;
    materials: MaterialOverrides;
    protectionZones: ProtectionZone[];
    constraints: ParsedDesignConstraints;
  }): Promise<{ imageUrl: string; description: string }>;
  visualSearchProducts(
    furniture: FurnitureItem[],
    activeStyle: StyleId,
    petFriendly: boolean
  ): Promise<VisualSearchMatch[]>;
}

class GeminiInteriorAIService implements IAIPipelineService {
  get isConfigured(): boolean {
    return hasGeminiApiKey();
  }

  get modeLabel(): string {
    const cfg = getAIServiceConfig();
    return cfg.mode === 'live' ? `Gemini AI (${cfg.imageModel})` : '尚未設定 Gemini Key';
  }

  analyzeUploadedRoom(params: {
    imageUrl: string;
    naturalWidth: number;
    naturalHeight: number;
    fallbackName?: string;
  }) {
    return analyzeUploadedRoomWithGemini(params);
  }

  async parseDesignConstraints(
    freeText: string,
    selectedTags: string[],
    options?: { allowLocalFallback?: boolean }
  ): Promise<ParsedDesignConstraints> {
    if (!hasGeminiApiKey() && options?.allowLocalFallback) {
      return parseConstraintsMock(freeText, selectedTags);
    }
    return parseConstraintsWithGemini(freeText, selectedTags);
  }

  generateRearrangementProposals(
    scene: RoomScene,
    furniture: FurnitureItem[],
    protectionZones: ProtectionZone[],
    constraints: ParsedDesignConstraints,
    lighting: LightingConfig
  ): Promise<RearrangementProposal[]> {
    return generateRearrangementPlanWithGemini({
      scene,
      furniture,
      protectionZones,
      constraints,
      lighting,
    });
  }

  renderRearrangedProposalImage(
    scene: RoomScene,
    proposal: RearrangementProposal,
    protectionZones: ProtectionZone[],
    constraints: ParsedDesignConstraints,
    lighting: LightingConfig
  ): Promise<{ imageUrl: string; description: string }> {
    return renderRearrangedRoomImageWithGemini({
      scene,
      proposal,
      protectionZones,
      constraints,
      lighting,
    });
  }

  generateStyleTransferImage(params: {
    scene: RoomScene;
    styleId: StyleId;
    intensity: number;
    protectionZones: ProtectionZone[];
    constraints: ParsedDesignConstraints;
    lighting: LightingConfig;
    materials: MaterialOverrides;
  }): Promise<{ imageUrl: string; description: string }> {
    return renderStyleTransferWithGemini(params);
  }

  analyzeObjectPlacementZones(
    scene: RoomScene,
    itemName: string,
    widthCm: number,
    depthCm: number,
    heightCm: number,
    protectionZones: ProtectionZone[],
    existingFurniture: FurnitureItem[]
  ): Promise<HighlightZone[]> {
    return analyzeObjectZonesWithGemini({
      scene,
      itemName,
      widthCm,
      depthCm,
      heightCm,
      protectionZones,
      existingFurniture,
    });
  }

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
  }): Promise<{ imageUrl: string; description: string }> {
    return compositeNewObjectWithGemini(params);
  }

  refineLightingAndMaterials(params: {
    baseImageUrl: string;
    imageWidth: number;
    imageHeight: number;
    lighting: LightingConfig;
    materials: MaterialOverrides;
    protectionZones: ProtectionZone[];
    constraints: ParsedDesignConstraints;
  }): Promise<{ imageUrl: string; description: string }> {
    return refineLightingAndMaterialsWithGemini(params);
  }

  async visualSearchProducts(
    furniture: FurnitureItem[],
    activeStyle: StyleId,
    petFriendly: boolean
  ): Promise<VisualSearchMatch[]> {
    return visualSearchMock(furniture, activeStyle, petFriendly);
  }
}

export const aiPipeline: IAIPipelineService = new GeminiInteriorAIService();
