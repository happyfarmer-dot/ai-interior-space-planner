import { EMPTY_ROOM_SCENE } from '../data/sampleScenes';
import type {
  CanvasViewMode,
  CoreDesignSnapshotState,
  CustomDesignPrompt,
  DesignMode,
  DesignVersionSnapshot,
  FurnitureItem,
  LightingConfig,
  MaterialOverrides,
  NewObjectConfig,
  ProtectionZone,
  RearrangementProposal,
  RoomScene,
  ScaleCalibration,
  StyleConfig,
  WorkflowStep,
} from '../types/design';
import { calculateBomReport } from '../utils/bomCalculator';
import { evaluateErgonomics } from '../utils/ergonomics';

export interface DesignStoreState {
  present: CoreDesignSnapshotState;
  undoStack: CoreDesignSnapshotState[];
  redoStack: CoreDesignSnapshotState[];
  snapshots: DesignVersionSnapshot[];
}

export function createInitialSnapshotState(
  scene: RoomScene = EMPTY_ROOM_SCENE
): CoreDesignSnapshotState {
  return {
    currentStep: 1,
    activeMode: 'style',
    viewMode: 'perspective',
    scene,
    calibration: { ...scene.defaultCalibration },
    protectionZones: scene.defaultProtectionZones.map((z) => ({ ...z, points: [...z.points] })),
    furniture: scene.defaultFurniture.map((f) => ({
      ...f,
      topDownPosCm: { ...f.topDownPosCm },
      imagePos: { ...f.imagePos },
      bboxNorm: { ...f.bboxNorm },
    })),
    proposals: [],
    selectedProposalId: null,
    styleConfig: {
      selectedStyleId: 'nordic',
      intensity: 88,
      applied: false,
    },
    newObject: {
      itemName: '北歐白蠟木焦糖休閒單椅',
      sourceUrl: './samples/item-lounge-chair.jpg',
      cutoutUrl: null,
      bgRemovalThreshold: 40,
      bgRemoved: false,
      widthCm: 74,
      depthCm: 78,
      heightCm: 76,
      suggestedZones: [],
      selectedZoneId: null,
      placed: false,
    },
    customPrompt: {
      selectedTags: ['寵物防抓耐磨', '預算上限 30 萬'],
      freeText: '家中有兩隻貓需防抓耐磨材質與貓跳台動線，預算上限 30 萬台幣，保留原有實木家具為主。',
      parsedJson: {
        maxBudgetTWD: 300000,
        petFriendly: true,
        catTreeRequired: true,
        preserveItems: ['現有實木家具'],
        minWalkwayCm: 75,
        requiredZones: ['寵物貓跳台垂直動線區'],
        materialRestrictions: [
          '禁選易勾紗絨布 / 須採防抓耐磨布料（>10萬轉）',
          '地坪建議超耐磨木地板或無縫微水泥',
        ],
        storagePriority: 'low',
        notes: [
          '已設定表面材＋軟裝總預算警戒上限 NT$ 300,000',
          '啟動寵物友善約束：材質庫與商品檢索將自動標記耐抓防水材質',
        ],
      },
      lastParsedAt: null,
    },
    lighting: {
      sunPreset: 'east_morning',
      kelvin: 4000,
      recessedDownlights: false,
      indirectCoveLight: false,
      ambientBrightness: 100,
    },
    materials: {
      floor: null,
      wall: null,
      sofa: null,
      curtain: null,
      activeTarget: null,
    },
  };
}

export function createInitialStoreState(): DesignStoreState {
  const initialPresent = createInitialSnapshotState(EMPTY_ROOM_SCENE);
  const ergo = evaluateErgonomics(
    initialPresent.scene,
    initialPresent.furniture,
    initialPresent.protectionZones
  );
  return {
    present: initialPresent,
    undoStack: [],
    redoStack: [],
    snapshots: [
      {
        id: 'snap-baseline',
        name: 'v0 初始工作區（待匯入空間照片）',
        createdAt: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
        summary: '請先於「功能 1」拍攝或上傳室內現況照片',
        ergonomicsScore: ergo.overallScore,
        estimatedMidTWD: 0,
        state: structuredClone(initialPresent),
      },
    ],
  };
}

export type DesignAction =
  | { type: 'SET_STEP'; step: WorkflowStep }
  | { type: 'SET_MODE'; mode: DesignMode }
  | { type: 'SET_VIEW_MODE'; viewMode: CanvasViewMode }
  | { type: 'LOAD_SCENE'; scene: RoomScene }
  | {
      type: 'UPDATE_SCENE_INFO';
      patch: { name?: string; areaPing?: number; widthCm?: number; depthCm?: number; heightCm?: number };
    }
  | { type: 'UPDATE_CALIBRATION'; patch: Partial<ScaleCalibration>; recordHistory?: boolean }
  | { type: 'ADD_PROTECTION_ZONE'; zone: ProtectionZone }
  | { type: 'TOGGLE_ZONE_LOCK'; id: string }
  | { type: 'REMOVE_PROTECTION_ZONE'; id: string }
  | { type: 'AUTO_DETECT_PROTECTION_ZONES'; zones: ProtectionZone[] }
  | { type: 'SET_PROPOSALS'; proposals: RearrangementProposal[] }
  | { type: 'APPLY_PROPOSAL'; proposalId: string }
  | { type: 'MOVE_FURNITURE_2D'; id: string; x: number; y: number; rotationDeg?: number }
  | { type: 'SET_STYLE_CONFIG'; patch: Partial<StyleConfig>; recordHistory?: boolean }
  | { type: 'SET_NEW_OBJECT'; patch: Partial<NewObjectConfig>; recordHistory?: boolean }
  | { type: 'PLACE_NEW_OBJECT_AT_ZONE'; zoneId: string }
  | { type: 'REMOVE_FURNITURE_ITEM'; id: string }
  | { type: 'SET_CUSTOM_PROMPT'; patch: Partial<CustomDesignPrompt>; recordHistory?: boolean }
  | { type: 'SET_LIGHTING'; patch: Partial<LightingConfig>; recordHistory?: boolean }
  | { type: 'SET_MATERIAL_OVERRIDE'; patch: Partial<MaterialOverrides>; recordHistory?: boolean }
  | { type: 'RESET_ALL_EDITS' }
  | { type: 'SAVE_SNAPSHOT'; name: string; summary: string }
  | { type: 'RESTORE_SNAPSHOT'; id: string }
  | { type: 'DELETE_SNAPSHOT'; id: string }
  | { type: 'UNDO' }
  | { type: 'REDO' };

function pushHistory(
  state: DesignStoreState,
  nextPresent: CoreDesignSnapshotState,
  recordHistory = true
): DesignStoreState {
  if (!recordHistory) {
    return { ...state, present: nextPresent };
  }
  const undoStack = [...state.undoStack, structuredClone(state.present)].slice(-35);
  return {
    ...state,
    present: nextPresent,
    undoStack,
    redoStack: [],
  };
}

export function designReducer(state: DesignStoreState, action: DesignAction): DesignStoreState {
  const cur = state.present;

  switch (action.type) {
    case 'UNDO': {
      if (state.undoStack.length === 0) return state;
      const previous = state.undoStack[state.undoStack.length - 1];
      return {
        ...state,
        present: previous,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [structuredClone(cur), ...state.redoStack].slice(0, 35),
      };
    }

    case 'REDO': {
      if (state.redoStack.length === 0) return state;
      const next = state.redoStack[0];
      return {
        ...state,
        present: next,
        undoStack: [...state.undoStack, structuredClone(cur)].slice(-35),
        redoStack: state.redoStack.slice(1),
      };
    }

    case 'SET_STEP':
      return { ...state, present: { ...cur, currentStep: action.step } };

    case 'SET_MODE':
      return pushHistory(state, { ...cur, activeMode: action.mode });

    case 'SET_VIEW_MODE':
      return { ...state, present: { ...cur, viewMode: action.viewMode } };

    case 'LOAD_SCENE': {
      const fresh = createInitialSnapshotState(action.scene);
      fresh.customPrompt = cur.customPrompt;
      return {
        ...state,
        present: fresh,
        undoStack: [...state.undoStack, structuredClone(cur)].slice(-35),
        redoStack: [],
      };
    }

    case 'UPDATE_SCENE_INFO': {
      const dims = {
        width: action.patch.widthCm ?? cur.scene.roomDimensionsCm.width,
        depth: action.patch.depthCm ?? cur.scene.roomDimensionsCm.depth,
        height: action.patch.heightCm ?? cur.scene.roomDimensionsCm.height,
      };
      return {
        ...state,
        present: {
          ...cur,
          scene: {
            ...cur.scene,
            name: action.patch.name ?? cur.scene.name,
            areaPing: action.patch.areaPing ?? cur.scene.areaPing,
            roomDimensionsCm: dims,
          },
        },
      };
    }

    case 'UPDATE_CALIBRATION':
      return pushHistory(
        state,
        {
          ...cur,
          calibration: { ...cur.calibration, ...action.patch },
        },
        action.recordHistory ?? true
      );

    case 'ADD_PROTECTION_ZONE':
      return pushHistory(state, {
        ...cur,
        protectionZones: [...cur.protectionZones, action.zone],
      });

    case 'TOGGLE_ZONE_LOCK':
      return pushHistory(state, {
        ...cur,
        protectionZones: cur.protectionZones.map((z) =>
          z.id === action.id ? { ...z, locked: !z.locked } : z
        ),
      });

    case 'REMOVE_PROTECTION_ZONE':
      return pushHistory(state, {
        ...cur,
        protectionZones: cur.protectionZones.filter((z) => z.id !== action.id),
      });

    case 'AUTO_DETECT_PROTECTION_ZONES': {
      const existingIds = new Set(cur.protectionZones.map((z) => z.id));
      const merged = [
        ...cur.protectionZones,
        ...action.zones.filter((z) => !existingIds.has(z.id)),
      ];
      return pushHistory(state, { ...cur, protectionZones: merged });
    }

    case 'SET_PROPOSALS':
      return {
        ...state,
        present: {
          ...cur,
          proposals: action.proposals,
          selectedProposalId: action.proposals[0]?.id ?? null,
        },
      };

    case 'APPLY_PROPOSAL': {
      const chosen = cur.proposals.find((p) => p.id === action.proposalId);
      if (!chosen) return state;
      return pushHistory(state, {
        ...cur,
        selectedProposalId: chosen.id,
        furniture: chosen.furnitureLayout.map((f) => ({
          ...f,
          topDownPosCm: { ...f.topDownPosCm },
          imagePos: { ...f.imagePos },
        })),
      });
    }

    case 'MOVE_FURNITURE_2D': {
      return pushHistory(state, {
        ...cur,
        furniture: cur.furniture.map((f) =>
          f.id === action.id
            ? {
                ...f,
                topDownPosCm: {
                  x: Math.max(0, Math.min(cur.scene.roomDimensionsCm.width - 30, action.x)),
                  y: Math.max(0, Math.min(cur.scene.roomDimensionsCm.depth - 30, action.y)),
                  rotationDeg: action.rotationDeg ?? f.topDownPosCm.rotationDeg,
                },
              }
            : f
        ),
      });
    }

    case 'SET_STYLE_CONFIG':
      return pushHistory(
        state,
        {
          ...cur,
          styleConfig: { ...cur.styleConfig, ...action.patch },
        },
        action.recordHistory ?? true
      );

    case 'SET_NEW_OBJECT':
      return pushHistory(
        state,
        {
          ...cur,
          newObject: { ...cur.newObject, ...action.patch },
        },
        action.recordHistory ?? false
      );

    case 'PLACE_NEW_OBJECT_AT_ZONE': {
      const zone = cur.newObject.suggestedZones.find((z) => z.id === action.zoneId);
      if (!zone) return state;

      // Remove any previously placed dynamic addon item for this slot to replace cleanly
      const filtered = cur.furniture.filter((f) => !f.id.startsWith('placed-addon-'));
      const placedItem: FurnitureItem = {
        id: `placed-addon-${Date.now()}`,
        name: cur.newObject.itemName || '新增單品家具',
        category: cur.newObject.itemName.includes('貓') ? 'cat_tree' : 'lounge_chair',
        widthCm: cur.newObject.widthCm,
        depthCm: cur.newObject.depthCm,
        heightCm: cur.newObject.heightCm,
        topDownPosCm: { ...zone.topDownPosCm },
        imagePos: {
          x: zone.imageAnchor.x,
          y: zone.imageAnchor.y,
          scale: zone.perspectiveScale,
        },
        bboxNorm: {
          x: Math.max(0.05, zone.imageAnchor.x - 0.08),
          y: Math.max(0.1, zone.imageAnchor.y - 0.25),
          w: 0.16,
          h: 0.28,
        },
        spriteUrl: cur.newObject.cutoutUrl || cur.newObject.sourceUrl || undefined,
        isOriginal: false,
        isPreserved: false,
        materialTag: '新增軟裝單品',
        estimatedPriceTWD: cur.newObject.itemName.includes('貓') ? 6490 : 12800,
        colorHex: '#C89F72',
      };

      return pushHistory(state, {
        ...cur,
        furniture: [...filtered, placedItem],
        newObject: {
          ...cur.newObject,
          selectedZoneId: action.zoneId,
          placed: true,
        },
      });
    }

    case 'REMOVE_FURNITURE_ITEM':
      return pushHistory(state, {
        ...cur,
        furniture: cur.furniture.filter((f) => f.id !== action.id),
      });

    case 'SET_CUSTOM_PROMPT':
      return pushHistory(
        state,
        {
          ...cur,
          customPrompt: { ...cur.customPrompt, ...action.patch },
        },
        action.recordHistory ?? false
      );

    case 'SET_LIGHTING':
      return pushHistory(
        state,
        {
          ...cur,
          lighting: { ...cur.lighting, ...action.patch },
        },
        action.recordHistory ?? true
      );

    case 'SET_MATERIAL_OVERRIDE':
      return pushHistory(
        state,
        {
          ...cur,
          materials: { ...cur.materials, ...action.patch },
        },
        action.recordHistory ?? true
      );

    case 'RESET_ALL_EDITS': {
      const reset = createInitialSnapshotState(cur.scene);
      return pushHistory(state, reset);
    }

    case 'SAVE_SNAPSHOT': {
      const ergo = evaluateErgonomics(
        cur.scene,
        cur.furniture,
        cur.protectionZones,
        cur.customPrompt.parsedJson.minWalkwayCm
      );
      const bom = calculateBomReport({
        scene: cur.scene,
        furniture: cur.furniture,
        styleConfig: cur.styleConfig,
        materials: cur.materials,
        lighting: cur.lighting,
        customPrompt: cur.customPrompt,
      });
      const snapshot: DesignVersionSnapshot = {
        id: `snap-${Date.now()}`,
        name: action.name,
        createdAt: new Date().toLocaleTimeString('zh-TW', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        summary: action.summary,
        ergonomicsScore: ergo.overallScore,
        estimatedMidTWD: Math.round((bom.grandMinTWD + bom.grandMaxTWD) / 2),
        state: structuredClone(cur),
      };
      return {
        ...state,
        snapshots: [snapshot, ...state.snapshots],
      };
    }

    case 'RESTORE_SNAPSHOT': {
      const target = state.snapshots.find((s) => s.id === action.id);
      if (!target) return state;
      return pushHistory(state, structuredClone(target.state));
    }

    case 'DELETE_SNAPSHOT':
      return {
        ...state,
        snapshots: state.snapshots.filter((s) => s.id !== action.id),
      };

    default:
      return state;
  }
}
