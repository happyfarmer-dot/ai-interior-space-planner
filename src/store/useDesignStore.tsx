import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  getGeminiRuntimeConfig,
  hasGeminiApiKey,
  hydrateGeminiConfigFromNativePrefs,
  subscribeGeminiConfig,
  type GeminiRuntimeConfig,
} from '../services/aiConfig';
import { aiPipeline } from '../services/aiPipeline';
import { GeminiServiceError } from '../services/geminiClient';
import type {
  ActiveCanvasTool,
  BomReport,
  ConversationalEditMessage,
  ErgonomicsReport,
  ProtectionCategory,
  RoomScene,
  VisualSearchMatch,
} from '../types/design';
import { calculateBomReport } from '../utils/bomCalculator';
import { evaluateErgonomics } from '../utils/ergonomics';
import { autoRemoveWhiteBackground, compressImageForAi } from '../utils/imageProcessing';
import {
  configureNativeAppShell,
  listenAppRestoredPhoto,
  pickImageWithNativeCamera,
} from '../utils/nativePlatform';
import {
  createInitialStoreState,
  designReducer,
  type DesignAction,
  type DesignStoreState,
} from './reducer';

export interface AiErrorBanner {
  message: string;
  needsKey?: boolean;
}

interface DesignContextValue {
  state: DesignStoreState;
  dispatch: React.Dispatch<DesignAction>;
  // Transient UI state
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
  cancelAiGeneration: () => void;
  aiError: AiErrorBanner | null;
  clearAiError: () => void;
  geminiConfig: GeminiRuntimeConfig;
  showGeminiSettings: boolean;
  setShowGeminiSettings: (v: boolean) => void;
  conversationalHistory: ConversationalEditMessage[];
  // Derived live reports
  ergonomics: ErgonomicsReport;
  bom: BomReport;
  visualSearchResults: VisualSearchMatch[];
  // Real Gemini AI pipeline actions & native photo handlers
  runDetectSceneVLM: () => Promise<void>;
  runParseConstraints: (
    freeText: string,
    tags: string[],
    options?: { allowLocalFallback?: boolean; fengShuiMode?: boolean }
  ) => Promise<void>;
  runGenerateProposals: () => Promise<void>;
  selectProposalWithAiRender: (proposalId: string) => Promise<void>;
  runApplyStyleTransfer: () => Promise<void>;
  runPrepareNewObject: (
    sourceUrl: string,
    itemName: string,
    widthCm: number,
    depthCm: number,
    heightCm: number,
    threshold?: number
  ) => Promise<void>;
  runPlaceNewObjectWithAi: (zoneId: string) => Promise<void>;
  runAiRefineLightingMaterials: () => Promise<void>;
  runConversationalEdit: (instruction: string) => Promise<void>;
  runVisualSearch: (options?: {
    cropBoxNorm?: { x: number; y: number; w: number; h: number };
    forceRefresh?: boolean;
  }) => Promise<void>;
  handleUploadCustomRoom: (file: File) => void;
  pickRoomPhotoNative: (source: 'camera' | 'photos') => Promise<void>;
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
  const [aiError, setAiError] = useState<AiErrorBanner | null>(null);
  const [geminiConfig, setGeminiConfig] = useState<GeminiRuntimeConfig>(getGeminiRuntimeConfig);
  const [showGeminiSettings, setShowGeminiSettings] = useState<boolean>(false);
  const [visualSearchResults, setVisualSearchResults] = useState<VisualSearchMatch[]>([]);
  const [conversationalHistory, setConversationalHistory] = useState<ConversationalEditMessage[]>(
    []
  );

  const abortControllerRef = useRef<AbortController | null>(null);
  const busyLockRef = useRef<boolean>(false);
  const lastVisualSearchImageRef = useRef<string | null>(null);

  const { present } = state;

  const clearAiError = useCallback(() => setAiError(null), []);

  const beginAiTask = useCallback((statusText: string): AbortSignal | null => {
    if (busyLockRef.current) return null;
    busyLockRef.current = true;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsAiBusy(statusText);
    return controller.signal;
  }, []);

  const endAiTask = useCallback(() => {
    busyLockRef.current = false;
    abortControllerRef.current = null;
    setIsAiBusy(null);
  }, []);

  const cancelAiGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    busyLockRef.current = false;
    abortControllerRef.current = null;
    setIsAiBusy(null);
  }, []);

  const handleAiError = useCallback((err: unknown) => {
    if (err instanceof GeminiServiceError) {
      if (err.code === 'ABORTED') {
        return;
      }
      setAiError({ message: err.message, needsKey: err.needsKey });
      if (err.needsKey) {
        setShowGeminiSettings(true);
      }
      return;
    }
    if (err && typeof err === 'object' && 'name' in err && (err as { name?: string }).name === 'AbortError') {
      return;
    }
    setAiError({
      message: err instanceof Error ? err.message : '執行 Gemini AI 發生未預期錯誤',
    });
  }, []);

  // Keep reactive sync with Gemini runtime configuration & hydrate Android Preferences
  useEffect(() => {
    const unsub = subscribeGeminiConfig((next) => setGeminiConfig(next));
    hydrateGeminiConfigFromNativePrefs();
    return unsub;
  }, []);

  // Configure native Capacitor shell (StatusBar + Android hardware backButton)
  useEffect(() => {
    let cleanupShell = () => {};
    configureNativeAppShell(() => {
      if (showGeminiSettings) {
        setShowGeminiSettings(false);
        return true;
      }
      if (present.currentStep > 1) {
        dispatch({ type: 'SET_STEP', step: (present.currentStep - 1) as 1 | 2 | 3 | 4 });
        return true;
      }
      return false;
    }).then((fn) => {
      cleanupShell = fn;
    });
    return () => {
      cleanupShell();
    };
  }, [present.currentStep, showGeminiSettings]);

  const loadCustomRoomFromDataUrl = useCallback(
    async (fileOrDataUrl: File | string, rawFileName: string, runVlmAutomatically = true) => {
      const compressed = await compressImageForAi(fileOrDataUrl, {
        maxLongEdge: 1536,
        minLongEdge: 1280,
        quality: 0.85,
        maxBytes: 300 * 1024,
      });

      const customScene: RoomScene = {
        id: `custom-${Date.now()}`,
        name: rawFileName.replace(/\.[^/.]+$/, '') || '室內現況照片',
        description: `已標準化壓縮為 ${compressed.width}×${compressed.height}px (${Math.round(
          compressed.byteSize / 1024
        )}KB)，可使用比例尺校準並執行 Gemini AI 設計。`,
        sourceType: 'upload',
        imageUrl: compressed.dataUrl,
        imageWidth: compressed.width,
        imageHeight: compressed.height,
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
          pixelPerCm: Number(((compressed.height * 0.76) / 210).toFixed(2)),
          showPerspectiveGrid: true,
          horizonY: 0.45,
          vanishingX: 0.5,
        },
        defaultProtectionZones: [],
        defaultFurniture: [],
      };

      dispatch({ type: 'LOAD_SCENE', scene: customScene });
      setVisualSearchResults([]);
      setConversationalHistory([]);
      lastVisualSearchImageRef.current = null;
      setZoom(1);
      setPanOffset({ x: 0, y: 0 });
      setAiError(null);

      if (runVlmAutomatically && hasGeminiApiKey()) {
        const signal = beginAiTask('Gemini AI 正在辨識照片中的家具、尺寸與門窗冷氣位置...');
        if (!signal) return;
        try {
          const vlm = await aiPipeline.analyzeUploadedRoom({
            imageUrl: compressed.dataUrl,
            naturalWidth: compressed.width,
            naturalHeight: compressed.height,
            fallbackName: customScene.name,
            signal,
          });
          dispatch({
            type: 'APPLY_VLM_SCENE_ANALYSIS',
            payload: {
              name: vlm.sceneName,
              description: vlm.description,
              roomDimensionsCm: vlm.roomDimensionsCm,
              areaPing: vlm.areaPing,
              windowSide: vlm.windowSide,
              tvWallCenterCm: vlm.tvWallCenterCm,
              doorSwing: vlm.doorSwing,
              surfacePolygons: vlm.surfacePolygons,
              furniture: vlm.furniture,
              protectionZones: vlm.protectionZones,
            },
          });
        } catch (err) {
          handleAiError(err);
        } finally {
          endAiTask();
        }
      }
    },
    [beginAiTask, endAiTask, handleAiError]
  );

  // Restore camera photo if Android recycled the WebView Activity while camera app ran
  useEffect(() => {
    let cleanupRestore = () => {};
    listenAppRestoredPhoto((dataUrl, format) => {
      loadCustomRoomFromDataUrl(dataUrl, `相機拍攝回復.${format || 'jpg'}`, true);
    }).then((fn) => {
      cleanupRestore = fn;
    });
    return () => {
      cleanupRestore();
    };
  }, [loadCustomRoomFromDataUrl]);

  // Derived real-time Ergonomics Check (with Taiwan Feng Shui check when enabled)
  const ergonomics = useMemo(
    () =>
      evaluateErgonomics(
        present.scene,
        present.furniture,
        present.protectionZones,
        present.customPrompt.parsedJson.minWalkwayCm,
        Boolean(present.customPrompt.parsedJson.fengShuiMode)
      ),
    [
      present.scene,
      present.furniture,
      present.protectionZones,
      present.customPrompt.parsedJson.minWalkwayCm,
      present.customPrompt.parsedJson.fengShuiMode,
    ]
  );

  // Derived real-time BOM Estimator
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

  // Desktop Undo/Redo keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) dispatch({ type: 'REDO' });
        else dispatch({ type: 'UNDO' });
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        dispatch({ type: 'REDO' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const runDetectSceneVLM = useCallback(async () => {
    if (!present.scene.imageUrl) return;
    const signal = beginAiTask('Gemini Vision AI 正在辨識照片中家具與結構／機電點位...');
    if (!signal) return;
    setAiError(null);
    try {
      const vlm = await aiPipeline.analyzeUploadedRoom({
        imageUrl: present.scene.imageUrl,
        naturalWidth: present.scene.imageWidth,
        naturalHeight: present.scene.imageHeight,
        fallbackName: present.scene.name,
        signal,
      });
      dispatch({
        type: 'APPLY_VLM_SCENE_ANALYSIS',
        payload: {
          name: vlm.sceneName,
          description: vlm.description,
          roomDimensionsCm: vlm.roomDimensionsCm,
          areaPing: vlm.areaPing,
          windowSide: vlm.windowSide,
          tvWallCenterCm: vlm.tvWallCenterCm,
          doorSwing: vlm.doorSwing,
          surfacePolygons: vlm.surfacePolygons,
          furniture: vlm.furniture,
          protectionZones: vlm.protectionZones,
        },
      });
    } catch (err) {
      handleAiError(err);
    } finally {
      endAiTask();
    }
  }, [beginAiTask, endAiTask, handleAiError, present.scene]);

  const runParseConstraints = useCallback(
    async (
      freeText: string,
      tags: string[],
      options?: { allowLocalFallback?: boolean; fengShuiMode?: boolean }
    ) => {
      const fengShuiMode =
        options?.fengShuiMode !== undefined
          ? options.fengShuiMode
          : Boolean(present.customPrompt.parsedJson.fengShuiMode);

      const signal = beginAiTask('Gemini AI 正在解析您的客製化裝潢約束條件...');
      if (!signal) return;
      setAiError(null);
      try {
        const parsed = await aiPipeline.parseDesignConstraints(freeText, tags, {
          allowLocalFallback: options?.allowLocalFallback,
          fengShuiMode,
          signal,
        });
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
      } catch (err) {
        handleAiError(err);
      } finally {
        endAiTask();
      }
    },
    [beginAiTask, endAiTask, handleAiError, present.customPrompt.parsedJson.fengShuiMode]
  );

  const runGenerateProposals = useCallback(async () => {
    if (!present.scene.imageUrl) return;
    setAiError(null);

    if (!hasGeminiApiKey()) {
      handleAiError(
        new GeminiServiceError(
          'MISSING_KEY',
          '請先設定 Gemini API Key，才能啟動真實 AI 家具辨識、重排演算與空間實景重繪。',
          true
        )
      );
      return;
    }

    const signal = beginAiTask('Gemini 空間設計引擎規劃多組配置並進行真實室景重排繪製中...');
    if (!signal) return;
    try {
      let activeFurniture = present.furniture;
      let activeProtection = present.protectionZones;
      let activeScene = present.scene;

      if (activeFurniture.length === 0) {
        const vlm = await aiPipeline.analyzeUploadedRoom({
          imageUrl: present.scene.imageUrl,
          naturalWidth: present.scene.imageWidth,
          naturalHeight: present.scene.imageHeight,
          fallbackName: present.scene.name,
          signal,
        });
        dispatch({
          type: 'APPLY_VLM_SCENE_ANALYSIS',
          payload: {
            name: vlm.sceneName,
            description: vlm.description,
            roomDimensionsCm: vlm.roomDimensionsCm,
            areaPing: vlm.areaPing,
            windowSide: vlm.windowSide,
            tvWallCenterCm: vlm.tvWallCenterCm,
            doorSwing: vlm.doorSwing,
            surfacePolygons: vlm.surfacePolygons,
            furniture: vlm.furniture,
            protectionZones: vlm.protectionZones,
          },
        });
        activeFurniture = vlm.furniture;
        activeProtection = [
          ...present.protectionZones.filter((z) => !z.autoDetected),
          ...vlm.protectionZones,
        ];
        activeScene = {
          ...present.scene,
          name: vlm.sceneName,
          roomDimensionsCm: vlm.roomDimensionsCm,
          areaPing: vlm.areaPing,
          windowSide: vlm.windowSide,
          tvWallCenterCm: vlm.tvWallCenterCm,
          doorSwing: vlm.doorSwing,
          defaultFurniture: vlm.furniture,
          defaultProtectionZones: vlm.protectionZones,
        };
      }

      const parsed = await aiPipeline.parseDesignConstraints(
        present.customPrompt.freeText,
        present.customPrompt.selectedTags,
        {
          fengShuiMode: Boolean(present.customPrompt.parsedJson.fengShuiMode),
          signal,
        }
      );
      dispatch({
        type: 'SET_CUSTOM_PROMPT',
        patch: { parsedJson: parsed, lastParsedAt: new Date().toLocaleTimeString('zh-TW') },
        recordHistory: false,
      });

      const proposals = await aiPipeline.generateRearrangementProposals(
        activeScene,
        activeFurniture,
        activeProtection,
        parsed,
        present.lighting,
        signal
      );

      dispatch({ type: 'SET_PROPOSALS', proposals });
      if (proposals[0]) {
        dispatch({ type: 'APPLY_PROPOSAL', proposalId: proposals[0].id });
      }
      dispatch({ type: 'SET_STEP', step: 3 });
      dispatch({ type: 'SET_VIEW_MODE', viewMode: 'split' });
    } catch (err) {
      handleAiError(err);
    } finally {
      endAiTask();
    }
  }, [
    beginAiTask,
    endAiTask,
    handleAiError,
    present.customPrompt,
    present.furniture,
    present.lighting,
    present.protectionZones,
    present.scene,
  ]);

  const selectProposalWithAiRender = useCallback(
    async (proposalId: string) => {
      const chosen = present.proposals.find((p) => p.id === proposalId);
      if (!chosen) return;
      dispatch({ type: 'APPLY_PROPOSAL', proposalId });

      if (chosen.aiRenderedImageUrl) return;

      const signal = beginAiTask(`Gemini AI 正在實景重繪「${chosen.title}」配置圖...`);
      if (!signal) return;
      setAiError(null);
      try {
        const res = await aiPipeline.renderRearrangedProposalImage(
          present.scene,
          chosen,
          present.protectionZones,
          present.customPrompt.parsedJson,
          present.lighting,
          signal
        );
        dispatch({
          type: 'CACHE_PROPOSAL_IMAGE',
          proposalId,
          imageUrl: res.imageUrl,
          description: res.description,
        });
      } catch (err) {
        handleAiError(err);
      } finally {
        endAiTask();
      }
    },
    [
      beginAiTask,
      endAiTask,
      handleAiError,
      present.customPrompt.parsedJson,
      present.lighting,
      present.proposals,
      present.protectionZones,
      present.scene,
    ]
  );

  const runApplyStyleTransfer = useCallback(async () => {
    if (!present.scene.imageUrl) return;
    setAiError(null);

    if (!hasGeminiApiKey()) {
      handleAiError(
        new GeminiServiceError(
          'MISSING_KEY',
          '請先設定 Gemini API Key，才能透過 Nano Banana 原生圖像引擎執行高擬真空間風格轉換。',
          true
        )
      );
      return;
    }

    const effectiveIntensity = present.styleConfig.intensity > 0 ? present.styleConfig.intensity : 88;
    const signal = beginAiTask('Gemini AI 圖像引擎正在進行風格重繪與材質光影融合...');
    if (!signal) return;
    try {
      const res = await aiPipeline.generateStyleTransferImage({
        scene: present.scene,
        styleId: present.styleConfig.selectedStyleId,
        intensity: effectiveIntensity,
        protectionZones: present.protectionZones,
        constraints: present.customPrompt.parsedJson,
        lighting: present.lighting,
        materials: present.materials,
        signal,
      });

      dispatch({
        type: 'SET_STYLE_CONFIG',
        patch: {
          applied: true,
          intensity: effectiveIntensity,
          renderedNote: res.description,
        },
        recordHistory: false,
      });
      dispatch({
        type: 'SET_AI_RENDER',
        imageUrl: res.imageUrl,
        mode: 'style',
        description: res.description,
        recordHistory: true,
      });
      dispatch({ type: 'SET_STEP', step: 3 });
      dispatch({ type: 'SET_VIEW_MODE', viewMode: 'split' });
    } catch (err) {
      handleAiError(err);
    } finally {
      endAiTask();
    }
  }, [
    beginAiTask,
    endAiTask,
    handleAiError,
    present.customPrompt.parsedJson,
    present.lighting,
    present.materials,
    present.protectionZones,
    present.scene,
    present.styleConfig.intensity,
    present.styleConfig.selectedStyleId,
  ]);

  const runPrepareNewObject = useCallback(
    async (
      sourceUrl: string,
      itemName: string,
      widthCm: number,
      depthCm: number,
      heightCm: number,
      threshold = 40
    ) => {
      const signal = beginAiTask('執行單品標準化壓縮、自動去背，並呼叫 Gemini 空間分析推薦最佳擺放區...');
      if (!signal) return;
      setAiError(null);
      try {
        const compressedObj = await compressImageForAi(sourceUrl, {
          maxLongEdge: 1280,
          minLongEdge: 960,
          quality: 0.85,
          maxBytes: 300 * 1024,
        });
        const cutoutUrl = await autoRemoveWhiteBackground(compressedObj.dataUrl, threshold);
        const zones = await aiPipeline.analyzeObjectPlacementZones(
          present.scene,
          itemName,
          widthCm,
          depthCm,
          heightCm,
          present.protectionZones,
          present.furniture,
          signal
        );
        dispatch({
          type: 'SET_NEW_OBJECT',
          patch: {
            sourceUrl: compressedObj.dataUrl,
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
      } catch (err) {
        handleAiError(err);
      } finally {
        endAiTask();
      }
    },
    [beginAiTask, endAiTask, handleAiError, present.furniture, present.protectionZones, present.scene]
  );

  const runPlaceNewObjectWithAi = useCallback(
    async (zoneId: string) => {
      const zone = present.newObject.suggestedZones.find((z) => z.id === zoneId);
      const itemImg = present.newObject.cutoutUrl || present.newObject.sourceUrl;
      if (!zone || !present.scene.imageUrl || !itemImg) return;

      const signal = beginAiTask(
        `Gemini AI 正在將「${present.newObject.itemName}」依透視比例合成至實景圖中...`
      );
      if (!signal) return;
      dispatch({ type: 'PLACE_NEW_OBJECT_AT_ZONE', zoneId });
      setAiError(null);
      try {
        const baseImageUrl =
          present.aiRenderedImageUrl &&
          (present.aiRenderMode === 'style' || present.aiRenderMode === 'rearrange')
            ? present.aiRenderedImageUrl
            : present.scene.imageUrl;

        const res = await aiPipeline.compositeNewObjectImage({
          baseImageUrl,
          imageWidth: present.scene.imageWidth,
          imageHeight: present.scene.imageHeight,
          objectImageUrl: itemImg,
          itemName: present.newObject.itemName,
          widthCm: present.newObject.widthCm,
          depthCm: present.newObject.depthCm,
          heightCm: present.newObject.heightCm,
          zone,
          constraints: present.customPrompt.parsedJson,
          lighting: present.lighting,
          signal,
        });

        dispatch({
          type: 'SET_AI_RENDER',
          imageUrl: res.imageUrl,
          mode: 'place_object',
          description: res.description,
          recordHistory: true,
        });
        dispatch({ type: 'SET_STEP', step: 3 });
        dispatch({ type: 'SET_VIEW_MODE', viewMode: 'split' });
      } catch (err) {
        handleAiError(err);
      } finally {
        endAiTask();
      }
    },
    [
      beginAiTask,
      endAiTask,
      handleAiError,
      present.aiRenderMode,
      present.aiRenderedImageUrl,
      present.customPrompt.parsedJson,
      present.lighting,
      present.newObject,
      present.scene,
    ]
  );

  const runAiRefineLightingMaterials = useCallback(async () => {
    if (!present.scene.imageUrl) return;
    const signal = beginAiTask('Gemini AI 正在依目前色溫與局部材質重繪空間實景圖...');
    if (!signal) return;
    setAiError(null);
    try {
      const baseImageUrl =
        present.aiRenderedImageUrl && present.aiRenderMode !== 'refine'
          ? present.aiRenderedImageUrl
          : present.scene.imageUrl;

      const res = await aiPipeline.refineLightingAndMaterials({
        baseImageUrl,
        imageWidth: present.scene.imageWidth,
        imageHeight: present.scene.imageHeight,
        lighting: present.lighting,
        materials: present.materials,
        protectionZones: present.protectionZones,
        constraints: present.customPrompt.parsedJson,
        signal,
      });

      dispatch({
        type: 'SET_AI_RENDER',
        imageUrl: res.imageUrl,
        mode: 'refine',
        description: res.description,
        recordHistory: true,
      });
      dispatch({ type: 'SET_VIEW_MODE', viewMode: 'split' });
    } catch (err) {
      handleAiError(err);
    } finally {
      endAiTask();
    }
  }, [
    beginAiTask,
    endAiTask,
    handleAiError,
    present.aiRenderMode,
    present.aiRenderedImageUrl,
    present.customPrompt.parsedJson,
    present.lighting,
    present.materials,
    present.protectionZones,
    present.scene,
  ]);

  const runConversationalEdit = useCallback(
    async (instruction: string) => {
      const trimmed = instruction.trim();
      if (!trimmed || !present.scene.imageUrl) return;

      if (!hasGeminiApiKey()) {
        handleAiError(
          new GeminiServiceError(
            'MISSING_KEY',
            '請先設定 Gemini API Key，才能執行多輪對話式局部微調。',
            true
          )
        );
        return;
      }

      const signal = beginAiTask(`Gemini 多模態局部微調中：「${trimmed.slice(0, 26)}」...`);
      if (!signal) return;
      setAiError(null);
      try {
        const baseImageUrl = present.aiRenderedImageUrl || present.scene.imageUrl;
        const res = await aiPipeline.conversationalEditImage({
          baseImageUrl,
          imageWidth: present.scene.imageWidth,
          imageHeight: present.scene.imageHeight,
          instruction: trimmed,
          history: conversationalHistory.map((m) => m.instruction),
          protectionZones: present.protectionZones,
          lighting: present.lighting,
          signal,
        });

        dispatch({
          type: 'SET_AI_RENDER',
          imageUrl: res.imageUrl,
          mode: 'refine',
          description: res.description,
          recordHistory: true,
        });
        setConversationalHistory((prev) => [
          ...prev,
          {
            id: `chat-${Date.now()}`,
            instruction: trimmed,
            createdAt: new Date().toLocaleTimeString('zh-TW', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            resultNote: res.description,
            fromCache: res.fromCache,
          },
        ]);
      } catch (err) {
        handleAiError(err);
      } finally {
        endAiTask();
      }
    },
    [
      beginAiTask,
      conversationalHistory,
      endAiTask,
      handleAiError,
      present.aiRenderedImageUrl,
      present.lighting,
      present.protectionZones,
      present.scene,
    ]
  );

  const runVisualSearch = useCallback(
    async (options?: {
      cropBoxNorm?: { x: number; y: number; w: number; h: number };
      forceRefresh?: boolean;
    }) => {
      const targetImage = present.aiRenderedImageUrl || present.scene.imageUrl;
      if (!targetImage) return;

      if (!hasGeminiApiKey()) {
        handleAiError(
          new GeminiServiceError(
            'MISSING_KEY',
            '請先設定 Gemini API Key，才能對模擬圖進行視覺物件偵測與購買連結推薦。',
            true
          )
        );
        return;
      }

      const signal = beginAiTask(
        options?.cropBoxNorm
          ? 'Gemini Vision 正在辨識您手動框選的單品與尺寸...'
          : 'Gemini Vision 正在掃描模擬圖中出現的傢俱與燈飾並比對台灣購買通路...'
      );
      if (!signal) return;
      setAiError(null);
      try {
        const res = await aiPipeline.detectPurchasableItems({
          imageUrl: targetImage,
          pixelPerCm: present.calibration.pixelPerCm,
          walkwayCm: ergonomics.mainWalkwayCm,
          roomDimensionsCm: present.scene.roomDimensionsCm,
          activeStyle: present.styleConfig.selectedStyleId,
          petFriendly: present.customPrompt.parsedJson.petFriendly,
          cropBoxNorm: options?.cropBoxNorm,
          forceRefresh: options?.forceRefresh,
          signal,
        });

        if (options?.cropBoxNorm && res.length > 0) {
          setVisualSearchResults((prev) => [res[0], ...prev]);
          setSelectedFurnitureId(res[0].slotId);
        } else {
          setVisualSearchResults(res);
          setSelectedFurnitureId(res[0]?.slotId ?? null);
          lastVisualSearchImageRef.current = targetImage;
        }
        setShowVisualSearchOverlay(true);
      } catch (err) {
        handleAiError(err);
      } finally {
        endAiTask();
      }
    },
    [
      beginAiTask,
      endAiTask,
      ergonomics.mainWalkwayCm,
      handleAiError,
      present.aiRenderedImageUrl,
      present.calibration.pixelPerCm,
      present.customPrompt.parsedJson.petFriendly,
      present.scene.imageUrl,
      present.scene.roomDimensionsCm,
      present.styleConfig.selectedStyleId,
    ]
  );

  // Auto-detect purchasable items when entering Step 4 if a rendered/room photo and API key exist
  useEffect(() => {
    const targetImage = present.aiRenderedImageUrl || present.scene.imageUrl;
    if (
      present.currentStep === 4 &&
      targetImage &&
      hasGeminiApiKey() &&
      !busyLockRef.current &&
      lastVisualSearchImageRef.current !== targetImage
    ) {
      lastVisualSearchImageRef.current = targetImage;
      runVisualSearch();
    }
  }, [present.currentStep, present.aiRenderedImageUrl, present.scene.imageUrl, runVisualSearch]);

  const handleUploadCustomRoom = useCallback(
    (file: File) => {
      loadCustomRoomFromDataUrl(file, file.name, true);
    },
    [loadCustomRoomFromDataUrl]
  );

  const pickRoomPhotoNative = useCallback(
    async (source: 'camera' | 'photos') => {
      setAiError(null);
      try {
        const picked = await pickImageWithNativeCamera(source);
        if (picked) {
          await loadCustomRoomFromDataUrl(picked.dataUrl, picked.fileName, true);
        }
      } catch (err) {
        setAiError({
          message: `無法取得相機或相簿照片：${
            err instanceof Error ? err.message : String(err)
          }（請確認已允許應用程式的相機與相片讀取權限）`,
        });
      }
    },
    [loadCustomRoomFromDataUrl]
  );

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
    cancelAiGeneration,
    aiError,
    clearAiError,
    geminiConfig,
    showGeminiSettings,
    setShowGeminiSettings,
    conversationalHistory,
    ergonomics,
    bom,
    visualSearchResults,
    runDetectSceneVLM,
    runParseConstraints,
    runGenerateProposals,
    selectProposalWithAiRender,
    runApplyStyleTransfer,
    runPrepareNewObject,
    runPlaceNewObjectWithAi,
    runAiRefineLightingMaterials,
    runConversationalEdit,
    runVisualSearch,
    handleUploadCustomRoom,
    pickRoomPhotoNative,
  };

  return <DesignContext.Provider value={value}>{children}</DesignContext.Provider>;
};

export function useDesignStore(): DesignContextValue {
  const ctx = useContext(DesignContext);
  if (!ctx) throw new Error('useDesignStore must be used inside DesignProvider');
  return ctx;
}
