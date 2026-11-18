import type {
  FurnitureItem,
  HighlightZone,
  ParsedDesignConstraints,
  ProtectionZone,
  RearrangementProposal,
  RoomScene,
  StyleId,
  VisualSearchMatch,
} from '../types/design';
import { getAIServiceConfig } from './aiConfig';
import {
  analyzeHighlightZonesMock,
  generateRearrangementProposalsMock,
  parseConstraintsMock,
  visualSearchMock,
} from './mockAiEngine';

export interface IAIPipelineService {
  readonly modeLabel: string;
  parseDesignConstraints(
    freeText: string,
    selectedTags: string[]
  ): Promise<ParsedDesignConstraints>;
  detectSceneElementsVLM(scene: RoomScene): Promise<{
    detectedFurnitureCount: number;
    detectedMepCount: number;
    confidence: number;
    notes: string;
  }>;
  generateRearrangementProposals(
    scene: RoomScene,
    furniture: FurnitureItem[],
    protectionZones: ProtectionZone[],
    constraints: ParsedDesignConstraints
  ): Promise<RearrangementProposal[]>;
  analyzeObjectPlacementZones(
    scene: RoomScene,
    widthCm: number,
    depthCm: number,
    protectionZones: ProtectionZone[],
    existingFurniture: FurnitureItem[]
  ): Promise<HighlightZone[]>;
  visualSearchProducts(
    furniture: FurnitureItem[],
    activeStyle: StyleId,
    petFriendly: boolean
  ): Promise<VisualSearchMatch[]>;
}

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

class HybridAIService implements IAIPipelineService {
  get modeLabel(): string {
    const cfg = getAIServiceConfig();
    return cfg.mode === 'live' ? 'Live API Pipeline' : 'Local AI Simulation Engine';
  }

  async parseDesignConstraints(
    freeText: string,
    selectedTags: string[]
  ): Promise<ParsedDesignConstraints> {
    const cfg = getAIServiceConfig();
    if (cfg.mode === 'live' && import.meta.env.VITE_LLM_API_KEY) {
      try {
        const res = await fetch(cfg.llmEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_LLM_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content:
                  'Extract structured interior design JSON constraints: maxBudgetTWD, petFriendly, catTreeRequired, preserveItems, minWalkwayCm, requiredZones, materialRestrictions, storagePriority, notes.',
              },
              {
                role: 'user',
                content: `Tags: ${selectedTags.join(', ')}\nNotes: ${freeText}`,
              },
            ],
          }),
        });
        if (res.ok) {
          const json = await res.json();
          const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? '{}');
          if (parsed && typeof parsed.petFriendly === 'boolean') {
            return parsed as ParsedDesignConstraints;
          }
        }
      } catch {
        // Fallback gracefully to deterministic parser
      }
    }

    await delay(280);
    return parseConstraintsMock(freeText, selectedTags);
  }

  async detectSceneElementsVLM(scene: RoomScene) {
    await delay(350);
    return {
      detectedFurnitureCount: scene.defaultFurniture.length,
      detectedMepCount: scene.defaultProtectionZones.length,
      confidence: 0.94,
      notes: `已識別 ${scene.defaultFurniture.length} 件現有家具與 ${scene.defaultProtectionZones.length} 處結構／機電限制區域`,
    };
  }

  async generateRearrangementProposals(
    scene: RoomScene,
    furniture: FurnitureItem[],
    protectionZones: ProtectionZone[],
    constraints: ParsedDesignConstraints
  ): Promise<RearrangementProposal[]> {
    await delay(420);
    return generateRearrangementProposalsMock(scene, furniture, protectionZones, constraints);
  }

  async analyzeObjectPlacementZones(
    scene: RoomScene,
    widthCm: number,
    depthCm: number,
    protectionZones: ProtectionZone[],
    existingFurniture: FurnitureItem[]
  ): Promise<HighlightZone[]> {
    await delay(320);
    return analyzeHighlightZonesMock(
      scene,
      widthCm,
      depthCm,
      protectionZones,
      existingFurniture
    );
  }

  async visualSearchProducts(
    furniture: FurnitureItem[],
    activeStyle: StyleId,
    petFriendly: boolean
  ): Promise<VisualSearchMatch[]> {
    await delay(260);
    return visualSearchMock(furniture, activeStyle, petFriendly);
  }
}

export const aiPipeline: IAIPipelineService = new HybridAIService();
