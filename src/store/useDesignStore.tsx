import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import { aiPipeline } from '../services/aiPipeline';
import type {
  ActiveCanvasTool,
  BomReport,
  ErgonomicsReport,
  ProtectionCategory,
  RoomScene,
  VisualSearchMatch,
} from '../types/design';
import { calculateBomReport } from '../utils/bomCalculator';
import { evaluateErgonomics } from '../utils/ergonomics';
import { autoRemoveWhiteBackground } from '../utils/imageProcessing';
import {
  createInitialStoreState,
  designReducer,
  type DesignAction,
  type DesignStoreState,
} from './reducer';

interface DesignContextValue {
  state: DesignStoreState;
  dispatch: React.Dispatch<DesignAction>;
  // UI canvas transient tools (not polluting undo stack)
  activeTool: ActiveCanvasTool;
  setActiveTool: (t: ActiveCanvasTool) => void;
  activeBrushCategory: ProtectionCategory;
  setActiveBrushCategory: (c: ProtectionCategory) => void;
  brushSizePx: number;
  setBrushSizePx: (n: number) => void;
  showProtectionOverlay: boolean;
  setShowProtectionOverlay: (v: boolean) => void;
  showErgonomicsOverlay: boolean;
  setShowErgonomicsOverlay: (v: boolean) => void;
  showVisualSearchOverlay: boolean;
  setShowVisualSearchOverlay: (v: boolean) => void;
  selectedFurnitureId: string | null;
  setSelectedFurnitureId: (id: string | null) => void;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  panOffset: { x: number; y: number };
  setPanOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  isAiBusy: string | null;
  // Derived live reports
  ergonomics: ErgonomicsReport;
  bom: BomReport;
  visualSearchResults: VisualSearchMatch[];
  // High-level async pipeline actions
  runParseConstraints: (freeText: string, tags: string[]) => Promise<void>;
  runGenerateProposals: () => Promise<void>;
  runApplyStyleTransfer: () => Promise<void>;
  runPrepareNewObject: (
    sourceUrl: string,
    itemName: string,
    widthCm: number,
    depthCm: number,
    heightCm: number,
    threshold?: number
  ) => Promise<void>;
  runVisualSearch: () => Promise<void>;
  handleUploadCustomRoom: (file: File) => void;
}

const DesignContext = createContext<DesignContextValue | null>(null);

export const DesignProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(designReducer, undefined, createInitialStoreState);

  const [activeTool, setActiveTool] = useState<ActiveCanvasTool>('select');
  const [activeBrushCategory, setActiveBrushCategory] =
    useState<ProtectionCategory>('electrical_panel');
  const [brushSizePx, setBrushSizePx] = useState<number>(28);
  const [showProtectionOverlay, setShowProtectionOverlay] = useState<boolean>(true);
  const [showErgonomicsOverlay, setShowErgonomicsOverlay] = useState<boolean>(true);
  const [showVisualSearchOverlay, setShowVisualSearchOverlay] = useState<boolean>(false);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isAiBusy, setIsAiBusy] = useState<string | null>(null);
  const [visualSearchResults, setVisualSearchResults] = useState<VisualSearchMatch[]>([]);

  const { present } = state;

  // Derived real-time Ergonomics Check (Module 6)
  const ergonomics = useMemo(
    () =>
      evaluateErgonomics(
        present.scene,
        present.furniture,
        present.protectionZones,
        present.customPrompt.parsedJson.minWalkwayCm
      ),
    [
      present.scene,
      present.furniture,
      present.protectionZones,
      present.customPrompt.parsedJson.minWalkwayCm,
    ]
  );

  // Derived real-time BOM Estimator (Module 11)
  const bom = useMemo(
    () =>
      calculateBomReport({
        scene: present.scene,
        furniture: present.furniture,
        styleConfig: present.styleConfig,
        materials: present.materials,
        lighting: present.lighting,
        customPrompt: present.customPrompt,
      }),
    [
      present.scene,
      present.furniture,
      present.styleConfig,
      present.materials,
      present.lighting,
      present.customPrompt,
    ]
  );

  // Keep Visual Search up-to-date automatically when furniture or style changes
  useEffect(() => {
    let cancelled = false;
    aiPipeline
      .visualSearchProducts(
        present.furniture,
        present.styleConfig.selectedStyleId,
        present.customPrompt.parsedJson.petFriendly
      )
      .then((res) => {
        if (!cancelled) setVisualSearchResults(res);
      });
    return () => {
      cancelled = true;
    };
  }, [
    present.furniture,
    present.styleConfig.selectedStyleId,
    present.customPrompt.parsedJson.petFriendly,
  ]);

  // Global keyboard shortcuts for Undo/Redo (Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          dispatch({ type: 'REDO' });
        } else {
          dispatch({ type: 'UNDO' });
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        dispatch({ type: 'REDO' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const runParseConstraints = useCallback(async (freeText: string, tags: string[]) => {
    setIsAiBusy('LLM 正在解析客製化裝潢約束條件...');
    try {
      const parsed = await aiPipeline.parseDesignConstraints(freeText, tags);
      dispatch({
        type: 'SET_CUSTOM_PROMPT',
        patch: {
          freeText,
          selectedTags: tags,
          parsedJson: parsed,
          lastParsedAt: new Date().toLocaleTimeString('zh-TW'),
        },
        recordHistory: true,
      });
    } finally {
      setIsAiBusy(null);
    }
  }, []);

  const runGenerateProposals = useCallback(async () => {
    setIsAiBusy('空間規劃引擎計算動線與避讓遮罩中...');
    try {
      const parsed = await aiPipeline.parseDesignConstraints(
        present.customPrompt.freeText,
        present.customPrompt.selectedTags
      );
      dispatch({
        type: 'SET_CUSTOM_PROMPT',
        patch: { parsedJson: parsed, lastParsedAt: new Date().toLocaleTimeString('zh-TW') },
        recordHistory: false,
      });
      const proposals = await aiPipeline.generateRearrangementProposals(
        present.scene,
        present.scene.defaultFurniture,
        present.protectionZones,
        parsed
      );
      dispatch({ type: 'SET_PROPOSALS', proposals });
      if (proposals[0]) {
        dispatch({ type: 'APPLY_PROPOSAL', proposalId: proposals[0].id });
      }
      dispatch({ type: 'SET_STEP', step: 3 });
      dispatch({ type: 'SET_VIEW_MODE', viewMode: 'floorplan' });
    } finally {
      setIsAiBusy(null);
    }
  }, [present.customPrompt, present.protectionZones, present.scene]);

  const runApplyStyleTransfer = useCallback(async () => {
    setIsAiBusy('AI 渲染管線生成空間風格模擬圖中...');
    try {
      await new Promise((r) => setTimeout(r, 380));
      dispatch({ type: 'SET_STYLE_CONFIG', patch: { applied: true }, recordHistory: true });
      dispatch({ type: 'SET_STEP', step: 3 });
      dispatch({ type: 'SET_VIEW_MODE', viewMode: 'split' });
    } finally {
      setIsAiBusy(null);
    }
  }, []);

  const runPrepareNewObject = useCallback(
    async (
      sourceUrl: string,
      itemName: string,
      widthCm: number,
      depthCm: number,
      heightCm: number,
      threshold = 40
    ) => {
      setIsAiBusy('執行單品自動去背與畸零空間透視演算...');
      try {
        const cutoutUrl = await autoRemoveWhiteBackground(sourceUrl, threshold);
        const zones = await aiPipeline.analyzeObjectPlacementZones(
          present.scene,
          widthCm,
          depthCm,
          present.protectionZones,
          present.furniture
        );
        dispatch({
          type: 'SET_NEW_OBJECT',
          patch: {
            sourceUrl,
            cutoutUrl,
            itemName,
            widthCm,
            depthCm,
            heightCm,
            bgRemovalThreshold: threshold,
            bgRemoved: true,
            suggestedZones: zones,
            selectedZoneId: zones[0]?.id ?? null,
          },
          recordHistory: true,
        });
        dispatch({ type: 'SET_VIEW_MODE', viewMode: 'perspective' });
      } finally {
        setIsAiBusy(null);
      }
    },
    [present.furniture, present.protectionZones, present.scene]
  );

  const runVisualSearch = useCallback(async () => {
    setIsAiBusy('以圖搜物比對台灣主流家居規格資料庫...');
    try {
      const res = await aiPipeline.visualSearchProducts(
        present.furniture,
        present.styleConfig.selectedStyleId,
        present.customPrompt.parsedJson.petFriendly
      );
      setVisualSearchResults(res);
      setShowVisualSearchOverlay(true);
    } finally {
      setIsAiBusy(null);
    }
  }, [
    present.furniture,
    present.styleConfig.selectedStyleId,
    present.customPrompt.parsedJson.petFriendly,
  ]);

  const handleUploadCustomRoom = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const customScene: RoomScene = {
          id: `custom-${Date.now()}`,
          name: file.name.replace(/\.[^/.]+$/, '') || '自訂上傳空間照片',
          description: '使用者上傳之室內現況照片，請使用比例尺拉線完成實際尺度校準。',
          sourceType: 'upload',
          imageUrl: dataUrl,
          imageWidth: img.naturalWidth || 1280,
          imageHeight: img.naturalHeight || 720,
          roomDimensionsCm: { width: 380, depth: 450, height: 280 },
          areaPing: 5.2,
          windowSide: 'left',
          tvWallCenterCm: { x: 25, y: 225 },
          doorSwing: {
            hingeCm: { x: 375, y: 440 },
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
              { x: 0.56, y: 0.80 },
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
            pixelPerCm: Number(((img.naturalHeight * 0.76) / 210).toFixed(2)),
            showPerspectiveGrid: true,
            horizonY: 0.45,
            vanishingX: 0.5,
          },
          defaultProtectionZones: [],
          defaultFurniture: [
            {
              id: 'furn-custom-sofa',
              name: '偵測主座椅區',
              category: 'sofa',
              widthCm: 205,
              depthCm: 86,
              heightCm: 80,
              topDownPosCm: { x: 280, y: 150, rotationDeg: 90 },
              imagePos: { x: 0.70, y: 0.82, scale: 1 },
              bboxNorm: { x: 0.56, y: 0.54, w: 0.28, h: 0.32 },
              isOriginal: true,
              isPreserved: true,
              colorHex: '#64748B',
            },
            {
              id: 'furn-custom-table',
              name: '偵測中央茶幾區',
              category: 'coffee_table',
              widthCm: 105,
              depthCm: 55,
              heightCm: 42,
              topDownPosCm: { x: 185, y: 195, rotationDeg: 90 },
              imagePos: { x: 0.52, y: 0.82, scale: 1 },
              bboxNorm: { x: 0.45, y: 0.62, w: 0.13, h: 0.20 },
              isOriginal: true,
              isPreserved: true,
              colorHex: '#9A7B56',
            },
          ],
        };
        dispatch({ type: 'LOAD_SCENE', scene: customScene });
        setZoom(1);
        setPanOffset({ x: 0, y: 0 });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }, []);

  const value: DesignContextValue = {
    state,
    dispatch,
    activeTool,
    setActiveTool,
    activeBrushCategory,
    setActiveBrushCategory,
    brushSizePx,
    setBrushSizePx,
    showProtectionOverlay,
    setShowProtectionOverlay,
    showErgonomicsOverlay,
    setShowErgonomicsOverlay,
    showVisualSearchOverlay,
    setShowVisualSearchOverlay,
    selectedFurnitureId,
    setSelectedFurnitureId,
    zoom,
    setZoom,
    panOffset,
    setPanOffset,
    isAiBusy,
    ergonomics,
    bom,
    visualSearchResults,
    runParseConstraints,
    runGenerateProposals,
    runApplyStyleTransfer,
    runPrepareNewObject,
    runVisualSearch,
    handleUploadCustomRoom,
  };

  return <DesignContext.Provider value={value}>{children}</DesignContext.Provider>;
};

export function useDesignStore(): DesignContextValue {
  const ctx = useContext(DesignContext);
  if (!ctx) throw new Error('useDesignStore must be used inside DesignProvider');
  return ctx;
}
