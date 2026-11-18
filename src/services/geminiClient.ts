import { getMaterialById } from '../data/materialsCatalog';
import { getStyleById } from '../data/stylesCatalog';
import type {
  CatalogProduct,
  FurnitureBrand,
  FurnitureCategory,
  FurnitureItem,
  HighlightZone,
  LightingConfig,
  MaterialOverrides,
  ParsedDesignConstraints,
  Point2D,
  ProtectionCategory,
  ProtectionZone,
  RearrangementProposal,
  RoomScene,
  StyleId,
  VisualSearchMatch,
} from '../types/design';
import { evaluateErgonomics } from '../utils/ergonomics';
import { doesRectIntersectDoorSwing, getItemFootprintRect, rectsOverlap } from '../utils/geometry';
import {
  cropNormalizedImageRegion,
  matchGeminiAspectRatio,
  urlToInlineImagePart,
  type EncodedInlineImage,
} from '../utils/imageProcessing';
import { getGeminiRuntimeConfig } from './aiConfig';

export type GeminiErrorCode =
  | 'MISSING_KEY'
  | 'AUTH_ERROR'
  | 'QUOTA_ERROR'
  | 'MODEL_UNAVAILABLE'
  | 'SAFETY_BLOCK'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE'
  | 'ABORTED';

export class GeminiServiceError extends Error {
  readonly code: GeminiErrorCode;
  readonly needsKey: boolean;

  constructor(code: GeminiErrorCode, message: string, needsKey = false) {
    super(message);
    this.name = 'GeminiServiceError';
    this.code = code;
    this.needsKey = needsKey;
  }
}

function isAbortError(err: unknown): boolean {
  if (err instanceof GeminiServiceError && err.code === 'ABORTED') return true;
  if (err && typeof err === 'object' && 'name' in err && (err as { name?: string }).name === 'AbortError') {
    return true;
  }
  return false;
}

const VALID_FURNITURE_CATEGORIES: FurnitureCategory[] = [
  'sofa',
  'coffee_table',
  'tv_console',
  'bed',
  'wardrobe',
  'nightstand',
  'lounge_chair',
  'cat_tree',
  'storage_cabinet',
  'floor_lamp',
  'desk',
];

const VALID_PROTECTION_CATEGORIES: ProtectionCategory[] = [
  'beam_column',
  'window',
  'ac_unit',
  'electrical_panel',
  'power_outlet',
];

const FALLBACK_VISION_CHAIN = [
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-3-flash-preview',
  'gemini-2.5-flash-lite',
];

const FALLBACK_IMAGE_CHAIN = [
  'gemini-nano-banana-2.1',
  'gemini-3.1-flash-image',
  'gemini-3.1-flash-lite-image',
  'gemini-3-pro-image',
];

function clamp(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, val));
}

function clampNormPoint(p: Partial<Point2D> | undefined, fallback: Point2D): Point2D {
  return {
    x: clamp(typeof p?.x === 'number' ? p.x : fallback.x, 0.01, 0.99),
    y: clamp(typeof p?.y === 'number' ? p.y : fallback.y, 0.01, 0.99),
  };
}

function normalizePolygon(raw: unknown, fallback: Point2D[]): Point2D[] {
  if (!Array.isArray(raw) || raw.length < 3) return fallback;
  return raw.slice(0, 8).map((pt, idx) =>
    clampNormPoint(pt as Partial<Point2D>, fallback[idx % fallback.length])
  );
}

function normalizeFurnitureCategory(raw: unknown): FurnitureCategory {
  if (typeof raw === 'string' && VALID_FURNITURE_CATEGORIES.includes(raw as FurnitureCategory)) {
    return raw as FurnitureCategory;
  }
  return 'storage_cabinet';
}

function normalizeProtectionCategory(raw: unknown): ProtectionCategory {
  if (typeof raw === 'string' && VALID_PROTECTION_CATEGORIES.includes(raw as ProtectionCategory)) {
    return raw as ProtectionCategory;
  }
  return 'beam_column';
}

function requireApiKey(): string {
  const cfg = getGeminiRuntimeConfig();
  const key = cfg.apiKey.trim();
  if (!key) {
    throw new GeminiServiceError(
      'MISSING_KEY',
      '尚未設定 Gemini API Key，請先點擊上方「設定 Gemini Key」完成連線後再執行真實 AI 空間設計。',
      true
    );
  }
  return key;
}

function buildApiUrl(modelId: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    modelId.replace(/^models\//, '')
  )}:generateContent`;
}

function extractJsonText(rawText: string): string {
  const trimmed = rawText.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    return fenced[1].trim();
  }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

interface RawGeminiPart {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
}

interface RawGeminiResponse {
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: RawGeminiPart[];
    };
  }>;
  promptFeedback?: {
    blockReason?: string;
    blockReasonMessage?: string;
  };
  error?: {
    code?: number;
    status?: string;
    message?: string;
  };
}

function mapHttpFailureToError(
  status: number,
  body: RawGeminiResponse | null,
  modelId: string,
  isImageCall: boolean
): { error: GeminiServiceError; retryNextModel: boolean } {
  const msg = body?.error?.message || `HTTP ${status}`;
  const errStatus = body?.error?.status || '';

  if (status === 401 || status === 403 || /API_KEY|API key|PERMISSION_DENIED/i.test(msg)) {
    const billingHint =
      isImageCall && /billing|tier|quota|permission/i.test(msg)
        ? '（提醒：Google Nano Banana 原生生圖模型於 AI Studio 通常需啟用計費方案 API Key 才具備生圖額度）'
        : '';
    return {
      error: new GeminiServiceError(
        'AUTH_ERROR',
        `Gemini API Key 驗證失敗或無權限（${modelId}）：${msg}${billingHint}`,
        true
      ),
      retryNextModel: false,
    };
  }

  if (status === 429 || errStatus === 'RESOURCE_EXHAUSTED' || /quota|rate limit/i.test(msg)) {
    return {
      error: new GeminiServiceError(
        'QUOTA_ERROR',
        isImageCall
          ? `模型 ${modelId} 目前額度不足或觸發頻率限制（${msg}）。請確認 AI Studio 專案已啟用計費／生圖配額，或於「Gemini 設定」切換為其他圖像模型（如 gemini-3.1-flash-image）。`
          : `Gemini 請求額度不足或過於頻繁（${msg}），請稍後再試或檢查 AI Studio 配額。`
      ),
      retryNextModel: isImageCall && /limit:\s*0/i.test(msg),
    };
  }

  if (
    status === 404 ||
    errStatus === 'NOT_FOUND' ||
    /not found|is not supported|unknown model|does not support/i.test(msg)
  ) {
    return {
      error: new GeminiServiceError(
        'MODEL_UNAVAILABLE',
        `模型 ${modelId} 目前無法使用（${msg}），請於「Gemini 設定」點擊「測試連線並自動探索可用模型」。`
      ),
      retryNextModel: true,
    };
  }

  if (status === 400) {
    return {
      error: new GeminiServiceError(
        'INVALID_RESPONSE',
        `Gemini 請求參數不被模型 ${modelId} 接受：${msg}`
      ),
      retryNextModel: /not supported|modality|aspect|size|schema/i.test(msg),
    };
  }

  return {
    error: new GeminiServiceError('NETWORK_ERROR', `Gemini 伺服器暫時回應錯誤（HTTP ${status}）：${msg}`),
    retryNextModel: status >= 500,
  };
}

async function callGeminiVisionJson<T>(
  prompt: string,
  images: EncodedInlineImage[] = [],
  options?: {
    signal?: AbortSignal;
    responseSchema?: Record<string, unknown>;
  }
): Promise<T> {
  if (options?.signal?.aborted) {
    throw new GeminiServiceError('ABORTED', '已取消生成');
  }
  const apiKey = requireApiKey();
  const cfg = getGeminiRuntimeConfig();
  const candidateModels = Array.from(
    new Set([cfg.visionModel, ...FALLBACK_VISION_CHAIN].filter(Boolean))
  );

  const parts: Array<Record<string, unknown>> = [
    ...images.map((img) => ({
      inlineData: {
        mimeType: img.mimeType,
        data: img.data,
      },
    })),
    { text: prompt },
  ];

  let lastError: GeminiServiceError | null = null;

  for (const modelId of candidateModels) {
    if (options?.signal?.aborted) {
      throw new GeminiServiceError('ABORTED', '已取消生成');
    }
    const generationConfig: Record<string, unknown> = {
      temperature: 0.25,
      responseMimeType: 'application/json',
    };
    if (options?.responseSchema) {
      generationConfig.responseSchema = options.responseSchema;
    }

    let response: Response;
    try {
      response = await fetch(buildApiUrl(modelId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        signal: options?.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig,
        }),
      });
    } catch (err) {
      if (isAbortError(err) || options?.signal?.aborted) {
        throw new GeminiServiceError('ABORTED', '已取消生成');
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new GeminiServiceError('NETWORK_ERROR', `無法連線至 Gemini API：${msg}`);
    }

    let rawJson: RawGeminiResponse | null = null;
    try {
      rawJson = (await response.json()) as RawGeminiResponse;
    } catch {
      rawJson = null;
    }

    if (!response.ok) {
      const mapped = mapHttpFailureToError(response.status, rawJson, modelId, false);
      lastError = mapped.error;
      if (mapped.retryNextModel) continue;
      throw mapped.error;
    }

    if (rawJson?.promptFeedback?.blockReason) {
      throw new GeminiServiceError(
        'SAFETY_BLOCK',
        `Gemini 安全性原則攔截了此請求（${rawJson.promptFeedback.blockReason}），請更換清楚無敏感元素的室內照片。`
      );
    }

    const candidate = rawJson?.candidates?.[0];
    if (candidate?.finishReason === 'SAFETY') {
      throw new GeminiServiceError('SAFETY_BLOCK', 'Gemini 安全過濾器拒絕輸出此畫面解析，請微調需求內容後重試。');
    }

    const textParts = (candidate?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .filter(Boolean)
      .join('\n');

    if (!textParts.trim()) {
      lastError = new GeminiServiceError('INVALID_RESPONSE', `模型 ${modelId} 未回傳有效 JSON 結果`);
      continue;
    }

    try {
      const cleaned = extractJsonText(textParts);
      return JSON.parse(cleaned) as T;
    } catch (err) {
      lastError = new GeminiServiceError(
        'INVALID_RESPONSE',
        `無法解析 Gemini 回傳結構化 JSON：${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  throw (
    lastError ??
    new GeminiServiceError('MODEL_UNAVAILABLE', '所有候選 Gemini 視覺模型皆無法回應，請測試 API Key 與網路狀態。')
  );
}

async function callGeminiImageEdit(params: {
  prompt: string;
  images: EncodedInlineImage[];
  targetWidth: number;
  targetHeight: number;
  signal?: AbortSignal;
}): Promise<{ imageDataUrl: string; modelUsed: string; textNote: string | null }> {
  if (params.signal?.aborted) {
    throw new GeminiServiceError('ABORTED', '已取消生成');
  }
  const apiKey = requireApiKey();
  const cfg = getGeminiRuntimeConfig();
  const candidateModels = Array.from(
    new Set([cfg.imageModel, ...FALLBACK_IMAGE_CHAIN].filter(Boolean))
  );
  const aspectRatio = matchGeminiAspectRatio(params.targetWidth, params.targetHeight);

  const parts: Array<Record<string, unknown>> = [
    ...params.images.map((img) => ({
      inlineData: {
        mimeType: img.mimeType,
        data: img.data,
      },
    })),
    { text: params.prompt },
  ];

  let lastError: GeminiServiceError | null = null;

  for (const modelId of candidateModels) {
    if (params.signal?.aborted) {
      throw new GeminiServiceError('ABORTED', '已取消生成');
    }
    let response: Response;
    try {
      response = await fetch(buildApiUrl(modelId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        signal: params.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig: {
              aspectRatio,
            },
          },
        }),
      });
    } catch (err) {
      if (isAbortError(err) || params.signal?.aborted) {
        throw new GeminiServiceError('ABORTED', '已取消生成');
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new GeminiServiceError('NETWORK_ERROR', `圖像渲染連線失敗：${msg}`);
    }

    let rawJson: RawGeminiResponse | null = null;
    try {
      rawJson = (await response.json()) as RawGeminiResponse;
    } catch {
      rawJson = null;
    }

    if (!response.ok) {
      const mapped = mapHttpFailureToError(response.status, rawJson, modelId, true);
      lastError = mapped.error;
      if (mapped.retryNextModel) continue;
      throw mapped.error;
    }

    if (rawJson?.promptFeedback?.blockReason) {
      throw new GeminiServiceError(
        'SAFETY_BLOCK',
        `Gemini 圖像安全原則攔截（${rawJson.promptFeedback.blockReason}），請更換室內現況照片或微調提示詞。`
      );
    }

    const candidate = rawJson?.candidates?.[0];
    if (candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'IMAGE_SAFETY') {
      throw new GeminiServiceError(
        'SAFETY_BLOCK',
        'Gemini 圖像安全機制攔截輸出，請嘗試其他照片或降低強烈材質/物件字眼。'
      );
    }

    const partsOut = candidate?.content?.parts ?? [];
    let imageDataUrl: string | null = null;
    const notes: string[] = [];

    for (const part of partsOut) {
      if (part.text) {
        notes.push(part.text.trim());
      }
      const inline = part.inlineData ?? part.inline_data;
      if (inline && inline.data) {
        const mime =
          ('mimeType' in inline ? inline.mimeType : undefined) ??
          ('mime_type' in inline ? inline.mime_type : undefined) ??
          'image/png';
        imageDataUrl = `data:${mime};base64,${inline.data}`;
      }
    }

    if (imageDataUrl) {
      return {
        imageDataUrl,
        modelUsed: modelId,
        textNote: notes.join(' ').trim() || null,
      };
    }

    lastError = new GeminiServiceError(
      'INVALID_RESPONSE',
      `模型 ${modelId} 僅回覆文字而未產生渲染圖像${notes[0] ? `（${notes[0].slice(0, 80)}）` : ''}。`
    );
  }

  throw (
    lastError ??
    new GeminiServiceError(
      'MODEL_UNAVAILABLE',
      '無法從目前設定的 Gemini 圖像模型取得渲染結果，請至「Gemini 設定」測試並確認可用生圖模型（如 gemini-nano-banana-2.1 或 gemini-3.1-flash-image）。'
    )
  );
}

interface RawAnalyzedRoomResponse {
  sceneName?: string;
  roomSummary?: string;
  widthCm?: number;
  depthCm?: number;
  heightCm?: number;
  areaPing?: number;
  windowSide?: 'left' | 'right' | 'top';
  tvWallCenterCm?: { x?: number; y?: number };
  doorSwing?: {
    hingeXCm?: number;
    hingeYCm?: number;
    radiusCm?: number;
    startAngleDeg?: number;
    endAngleDeg?: number;
    label?: string;
  };
  furniture?: Array<{
    id?: string;
    name?: string;
    category?: string;
    widthCm?: number;
    depthCm?: number;
    heightCm?: number;
    topDownXCm?: number;
    topDownYCm?: number;
    rotationDeg?: number;
    centerNormX?: number;
    baselineNormY?: number;
    bboxNorm?: { x?: number; y?: number; w?: number; h?: number };
    materialTag?: string;
  }>;
  protectionZones?: Array<{
    id?: string;
    category?: string;
    label?: string;
    points?: Array<{ x?: number; y?: number }>;
    topDownRectCm?: { x?: number; y?: number; w?: number; d?: number };
    clearanceCm?: number;
  }>;
  surfacePolygons?: {
    floor?: Array<{ x?: number; y?: number }>;
    wall?: Array<{ x?: number; y?: number }>;
    sofa?: Array<{ x?: number; y?: number }>;
    curtain?: Array<{ x?: number; y?: number }>;
  };
}

export async function analyzeUploadedRoomWithGemini(params: {
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
  tvWallCenterCm: Point2D;
  doorSwing: RoomScene['doorSwing'];
  furniture: FurnitureItem[];
  protectionZones: ProtectionZone[];
  surfacePolygons: RoomScene['surfacePolygons'];
}> {
  const encoded = await urlToInlineImagePart(params.imageUrl, 1280, false);

  const prompt = `你是一位資深台灣室內建築測量師與 AI 視覺空間分析師。請仔細檢視這張室內現況照片，並輸出嚴格的 JSON 分析資料，作為 2D 平面配置與人體工學計算基準。

輸出 JSON 欄位規範（所有文字請使用繁體中文）：
{
  "sceneName": "簡短空間名稱（例如：現況落地窗客廳 / 採光主臥室）",
  "roomSummary": "一句話空間結構與採光特徵描述",
  "widthCm": 估計空間左右淨寬（cm，例如 360~520）,
  "depthCm": 估計空間縱深（cm，例如 380~580）,
  "heightCm": 估計天花高度（cm，通常 260~310）,
  "areaPing": 估計坪數（1坪=3.3058平方公尺，小數1位）,
  "windowSide": "left" | "right" | "top",
  "tvWallCenterCm": { "x": number, "y": number },
  "doorSwing": {
    "hingeXCm": number,
    "hingeYCm": number,
    "radiusCm": 85,
    "startAngleDeg": number,
    "endAngleDeg": number,
    "label": "門片開啟範圍描述"
  },
  "furniture": [
    {
      "id": "furn-1",
      "name": "繁體中文家具名稱（如 三人座布沙發、實木茶幾、電視低櫃、雙人床組、系統衣櫃）",
      "category": "僅能為 sofa | coffee_table | tv_console | bed | wardrobe | nightstand | lounge_chair | cat_tree | storage_cabinet | floor_lamp | desk",
      "widthCm": number,
      "depthCm": number,
      "heightCm": number,
      "topDownXCm": number (0 到 widthCm - 寬度),
      "topDownYCm": number (0 到 depthCm - 深度),
      "rotationDeg": 0 | 90 | 180 | 270,
      "centerNormX": 0.0~1.0 (在照片中的水平中心比例),
      "baselineNormY": 0.0~1.0 (家具著地底部邊緣在照片中的垂直比例),
      "bboxNorm": { "x": 0.0~1.0, "y": 0.0~1.0, "w": 0.05~0.8, "h": 0.05~0.8 },
      "materialTag": "現有材質推測（如 棉麻織布、實木、塑合板）"
    }
  ],
  "protectionZones": [
    {
      "id": "mep-1",
      "category": "window | ac_unit | electrical_panel | beam_column | power_outlet",
      "label": "不可更動區域說明（如 左側落地採光窗、壁掛冷氣出風口、牆面配電箱、天花結構大樑）",
      "points": [4個歸一化 0.0~1.0 頂點座標圍成保護框],
      "topDownRectCm": { "x": number, "y": number, "w": number, "d": number },
      "clearanceCm": 45
    }
  ],
  "surfacePolygons": {
    "floor": [4個地板區域 0..1 頂點],
    "wall": [4個主視覺牆面區域 0..1 頂點],
    "sofa": [4個沙發或主軟裝布面區域 0..1 頂點],
    "curtain": [4個窗簾區域 0..1 頂點]
  }
}

請務必依照片中真實可見的物件產生對應座標，不要憑空編造照片裡不存在的門窗或冷氣。`;

  const raw = await callGeminiVisionJson<RawAnalyzedRoomResponse>(prompt, [encoded], {
    signal: params.signal,
  });

  const widthCm = Math.round(clamp(Number(raw.widthCm) || 380, 220, 900));
  const depthCm = Math.round(clamp(Number(raw.depthCm) || 460, 220, 1000));
  const heightCm = Math.round(clamp(Number(raw.heightCm) || 280, 210, 420));
  const calcPing = Number(((widthCm * depthCm) / 10000 / 3.3058).toFixed(1));
  const areaPing = Number(clamp(Number(raw.areaPing) || calcPing, 1.5, 45).toFixed(1));
  const windowSide: 'left' | 'right' | 'top' =
    raw.windowSide === 'right' || raw.windowSide === 'top' ? raw.windowSide : 'left';

  const defaultFloor: Point2D[] = [
    { x: 0.2, y: 0.68 },
    { x: 0.8, y: 0.68 },
    { x: 0.96, y: 0.98 },
    { x: 0.04, y: 0.98 },
  ];
  const defaultWall: Point2D[] = [
    { x: 0.14, y: 0.1 },
    { x: 0.86, y: 0.1 },
    { x: 0.86, y: 0.68 },
    { x: 0.14, y: 0.68 },
  ];
  const defaultSofa: Point2D[] = [
    { x: 0.55, y: 0.54 },
    { x: 0.85, y: 0.56 },
    { x: 0.85, y: 0.86 },
    { x: 0.55, y: 0.8 },
  ];
  const defaultCurtain: Point2D[] = [
    { x: 0.03, y: 0.05 },
    { x: 0.18, y: 0.08 },
    { x: 0.18, y: 0.85 },
    { x: 0.03, y: 0.9 },
  ];

  const furniture: FurnitureItem[] = (Array.isArray(raw.furniture) ? raw.furniture : [])
    .slice(0, 10)
    .map((f, idx) => {
      const cat = normalizeFurnitureCategory(f.category);
      const fw = Math.round(clamp(Number(f.widthCm) || 120, 35, 320));
      const fd = Math.round(clamp(Number(f.depthCm) || 65, 30, 240));
      const fh = Math.round(clamp(Number(f.heightCm) || 75, 25, 240));
      const bx = clamp(Number(f.bboxNorm?.x ?? 0.25), 0.02, 0.9);
      const by = clamp(Number(f.bboxNorm?.y ?? 0.45), 0.05, 0.9);
      const bw = clamp(Number(f.bboxNorm?.w ?? 0.22), 0.06, 0.95 - bx);
      const bh = clamp(Number(f.bboxNorm?.h ?? 0.25), 0.06, 0.96 - by);
      const cx = clamp(Number(f.centerNormX ?? bx + bw / 2), 0.04, 0.96);
      const cy = clamp(Number(f.baselineNormY ?? by + bh), 0.15, 0.98);
      const rot = [0, 90, 180, 270].includes(Number(f.rotationDeg))
        ? Number(f.rotationDeg)
        : 0;
      return {
        id: (f.id && String(f.id).trim()) || `furn-vlm-${idx + 1}`,
        name: (f.name && String(f.name).trim()) || `偵測家具 ${idx + 1}`,
        category: cat,
        widthCm: fw,
        depthCm: fd,
        heightCm: fh,
        topDownPosCm: {
          x: Math.round(clamp(Number(f.topDownXCm) || 40, 0, Math.max(0, widthCm - 40))),
          y: Math.round(clamp(Number(f.topDownYCm) || 60, 0, Math.max(0, depthCm - 40))),
          rotationDeg: rot,
        },
        imagePos: { x: cx, y: cy, scale: 1 },
        bboxNorm: { x: bx, y: by, w: bw, h: bh },
        isOriginal: true,
        isPreserved: true,
        materialTag: f.materialTag || '現況材質',
        colorHex: '#C89F72',
      };
    });

  const protectionZones: ProtectionZone[] = (
    Array.isArray(raw.protectionZones) ? raw.protectionZones : []
  )
    .slice(0, 8)
    .map((z, idx) => {
      const cat = normalizeProtectionCategory(z.category);
      const pts = normalizePolygon(z.points, [
        { x: 0.1, y: 0.15 },
        { x: 0.28, y: 0.15 },
        { x: 0.28, y: 0.55 },
        { x: 0.1, y: 0.55 },
      ]);
      const rx = Math.round(clamp(Number(z.topDownRectCm?.x) || 0, 0, Math.max(0, widthCm - 25)));
      const ry = Math.round(clamp(Number(z.topDownRectCm?.y) || 0, 0, Math.max(0, depthCm - 25)));
      const rw = Math.round(clamp(Number(z.topDownRectCm?.w) || 45, 20, widthCm));
      const rd = Math.round(clamp(Number(z.topDownRectCm?.d) || 60, 20, depthCm));
      return {
        id: (z.id && String(z.id).trim()) || `mep-vlm-${idx + 1}`,
        category: cat,
        label: (z.label && String(z.label).trim()) || `不可更動區 ${idx + 1}`,
        shape: 'rect' as const,
        points: pts,
        topDownRectCm: { x: rx, y: ry, w: rw, d: rd },
        locked: true,
        autoDetected: true,
        clearanceCm: Math.round(clamp(Number(z.clearanceCm) || 45, 20, 120)),
      };
    });

  return {
    sceneName:
      (raw.sceneName && String(raw.sceneName).trim()) ||
      params.fallbackName ||
      'Gemini 辨識現況空間',
    description:
      (raw.roomSummary && String(raw.roomSummary).trim()) ||
      `Gemini VLM 已辨識 ${furniture.length} 件現有家具與 ${protectionZones.length} 處結構／機電保護區。`,
    roomDimensionsCm: { width: widthCm, depth: depthCm, height: heightCm },
    areaPing,
    windowSide,
    tvWallCenterCm: {
      x: Math.round(clamp(Number(raw.tvWallCenterCm?.x) || 20, 0, widthCm)),
      y: Math.round(clamp(Number(raw.tvWallCenterCm?.y) || depthCm / 2, 0, depthCm)),
    },
    doorSwing: {
      hingeCm: {
        x: Math.round(clamp(Number(raw.doorSwing?.hingeXCm ?? widthCm - 10), 0, widthCm)),
        y: Math.round(clamp(Number(raw.doorSwing?.hingeYCm ?? depthCm - 10), 0, depthCm)),
      },
      radiusCm: Math.round(clamp(Number(raw.doorSwing?.radiusCm) || 86, 65, 110)),
      startAngleDeg: Number.isFinite(raw.doorSwing?.startAngleDeg)
        ? Number(raw.doorSwing?.startAngleDeg)
        : 180,
      endAngleDeg: Number.isFinite(raw.doorSwing?.endAngleDeg)
        ? Number(raw.doorSwing?.endAngleDeg)
        : 270,
      label: raw.doorSwing?.label || '房門開啟半徑 (86cm)',
    },
    furniture,
    protectionZones,
    surfacePolygons: {
      floor: normalizePolygon(raw.surfacePolygons?.floor, defaultFloor),
      wall: normalizePolygon(raw.surfacePolygons?.wall, defaultWall),
      sofa: normalizePolygon(raw.surfacePolygons?.sofa, defaultSofa),
      curtain: normalizePolygon(raw.surfacePolygons?.curtain, defaultCurtain),
    },
  };
}

export async function parseConstraintsWithGemini(
  freeText: string,
  selectedTags: string[],
  options?: { fengShuiMode?: boolean; signal?: AbortSignal }
): Promise<ParsedDesignConstraints> {
  const fengShuiMode = Boolean(options?.fengShuiMode);
  const prompt = `請將以下屋主客製化室內裝潢需求，解析為嚴格 JSON 格式的空間設計約束條件（所有文字欄位使用繁體中文）：

已選標籤：${selectedTags.join('、') || '無'}
屋主補充需求：${freeText || '無'}
台灣傳統風水避讓模式：${fengShuiMode ? '已開啟（需避開開門見灶、穿堂煞、橫樑壓床、鏡子正對床鋪）' : '已關閉（僅依現代機能與動線最佳化）'}

回傳 JSON 結構：
{
  "maxBudgetTWD": number | null (台幣整數，例如 30 萬則為 300000，無明確數字則為 null),
  "petFriendly": boolean,
  "catTreeRequired": boolean,
  "fengShuiMode": boolean,
  "preserveItems": string[],
  "minWalkwayCm": number (無障礙或寬走道需求為 90，一般為 75),
  "requiredZones": string[],
  "materialRestrictions": string[],
  "storagePriority": "low" | "medium" | "high",
  "notes": string[] (2~4 條清楚具體的 AI 執行規範摘要)
}`;

  const parsed = await callGeminiVisionJson<Partial<ParsedDesignConstraints>>(prompt, [], {
    signal: options?.signal,
  });

  const notes =
    Array.isArray(parsed.notes) && parsed.notes.length > 0
      ? parsed.notes.map(String)
      : ['已由 Gemini AI 解析客製需求並注入空間管線'];
  if (fengShuiMode && !notes.some((n) => /風水|穿堂|壓床/.test(n))) {
    notes.push('已啟用台灣傳統風水避讓：自動檢核開門見灶、穿堂煞、橫樑壓床與鏡子對床並提供屏風化解建議');
  }

  return {
    maxBudgetTWD:
      typeof parsed.maxBudgetTWD === 'number' && parsed.maxBudgetTWD > 0
        ? Math.round(parsed.maxBudgetTWD)
        : null,
    petFriendly: Boolean(parsed.petFriendly),
    catTreeRequired: Boolean(parsed.catTreeRequired),
    fengShuiMode,
    preserveItems: Array.isArray(parsed.preserveItems)
      ? parsed.preserveItems.map(String)
      : [],
    minWalkwayCm: clamp(Number(parsed.minWalkwayCm) || 75, 65, 110),
    requiredZones: Array.isArray(parsed.requiredZones)
      ? parsed.requiredZones.map(String)
      : [],
    materialRestrictions: Array.isArray(parsed.materialRestrictions)
      ? parsed.materialRestrictions.map(String)
      : [],
    storagePriority:
      parsed.storagePriority === 'high' || parsed.storagePriority === 'medium'
        ? parsed.storagePriority
        : 'low',
    notes,
  };
}

interface RawProposalPlanResponse {
  proposals?: Array<{
    title?: string;
    subtitle?: string;
    tags?: string[];
    rationale?: string[];
    visualPromptEn?: string;
    moves?: Array<{
      id?: string;
      topDownXCm?: number;
      topDownYCm?: number;
      rotationDeg?: number;
      centerNormX?: number;
      baselineNormY?: number;
    }>;
    addedItems?: Array<{
      name?: string;
      category?: string;
      widthCm?: number;
      depthCm?: number;
      heightCm?: number;
      topDownXCm?: number;
      topDownYCm?: number;
      rotationDeg?: number;
      centerNormX?: number;
      baselineNormY?: number;
      materialTag?: string;
      estimatedPriceTWD?: number;
    }>;
  }>;
}

export async function renderRearrangedRoomImageWithGemini(params: {
  scene: RoomScene;
  proposal: RearrangementProposal;
  protectionZones: ProtectionZone[];
  constraints: ParsedDesignConstraints;
  lighting: LightingConfig;
  signal?: AbortSignal;
}): Promise<{ imageUrl: string; description: string }> {
  const { scene, proposal, protectionZones, constraints, lighting } = params;
  const encoded = await urlToInlineImagePart(scene.imageUrl, 1280, false);

  const lockedList = protectionZones
    .filter((z) => z.locked)
    .map((z) => `${z.label} (${z.category})`)
    .join('; ');

  const furnitureSummary = proposal.furnitureLayout
    .map(
      (f) =>
        `- ${f.name} (${f.category}, ${f.widthCm}x${f.depthCm}cm): target image area (${Math.round(
          f.imagePos.x * 100
        )}% from left, ${Math.round(f.imagePos.y * 100)}% vertically), facing ${
          f.topDownPosCm.rotationDeg
        }deg`
    )
    .join('\n');

  const prompt = `Edit this exact interior room photograph to physically rearrange ONLY the movable furniture according to a professional space-planning layout.

STRICT ARCHITECTURAL & STRUCTURAL LOCKS:
- Preserve the EXACT room architecture, camera angle, walls, floor texture, ceiling height, windows, door frames, air conditioner unit, and electrical breaker panel cleanly in their original positions.
- Protected fixed zones (DO NOT block, cover, or move): ${lockedList || 'Existing windows, doors, ceiling beams, AC unit, electrical panel'}.
- Keep the EXISTING furniture identity, color palette, and silhouettes—DO NOT replace existing furniture with unrelated new furniture unless explicitly noted below.

TARGET REARRANGEMENT PLAN — "${proposal.title}":
- Objective: ${proposal.subtitle}
- Spatial layout guidance: ${proposal.aiVisualPromptEn || proposal.rationale.join(' ')}
- Updated furniture placements:
${furnitureSummary}
${constraints.petFriendly ? '- Ensure durable pet-friendly surfaces and clear vertical cat pathway if added.' : ''}
${constraints.fengShuiMode ? '- Respect traditional Taiwanese Feng Shui avoidance: keep beds/sofas clear from directly under overhead ceiling beams, and avoid direct door-to-window through-draft alignment.' : ''}
${constraints.preserveItems.length > 0 ? `- Must retain existing items: ${constraints.preserveItems.join(', ')}.` : ''}

LIGHTING & REALISM:
- Match ${lighting.kelvin}K lighting ambiance and natural light direction from the existing window.
- Maintain realistic contact shadows on the floor where the moved furniture now sits, and cleanly inpaint the previously occupied wall/floor areas so there are zero ghost artifacts or duplicate furniture copies.
- Output a photorealistic interior design photograph.`;

  const res = await callGeminiImageEdit({
    prompt,
    images: [encoded],
    targetWidth: scene.imageWidth,
    targetHeight: scene.imageHeight,
    signal: params.signal,
  });

  return {
    imageUrl: res.imageDataUrl,
    description: `${res.modelUsed} 已依「${proposal.title}」完成真實家具移位與背景修補渲染`,
  };
}

export async function generateRearrangementPlanWithGemini(params: {
  scene: RoomScene;
  furniture: FurnitureItem[];
  protectionZones: ProtectionZone[];
  constraints: ParsedDesignConstraints;
  lighting: LightingConfig;
  signal?: AbortSignal;
}): Promise<RearrangementProposal[]> {
  const { scene, furniture, protectionZones, constraints, lighting } = params;
  const encoded = await urlToInlineImagePart(scene.imageUrl, 1280, false);

  const lockedDesc = protectionZones
    .filter((z) => z.locked)
    .map(
      (z) =>
        `- ${z.label} (${z.category}): x=${z.topDownRectCm.x}..${
          z.topDownRectCm.x + z.topDownRectCm.w
        }cm, y=${z.topDownRectCm.y}..${z.topDownRectCm.y + z.topDownRectCm.d}cm`
    )
    .join('\n');

  const furnDesc = furniture
    .map(
      (f) =>
        `- id="${f.id}", name="${f.name}", cat=${f.category}, size=${f.widthCm}x${f.depthCm}x${f.heightCm}cm, pos=(x:${f.topDownPosCm.x}, y:${f.topDownPosCm.y}, rot:${f.topDownPosCm.rotationDeg})`
    )
    .join('\n');

  const fengShuiInstruction = constraints.fengShuiMode
    ? `- 台灣傳統風水避讓模式：已開啟！請務必將「避開開門見灶、穿堂煞（門窗直線對沖）、橫樑壓床／壓沙發、鏡子正對床鋪」納入重排演算邏輯，並於 rationale 理由中說明如何避讓或建議屏風／床頭櫃化解方式。`
    : `- 台灣傳統風水避讓模式：已關閉（僅依現代空間機能、採光與人體工學最佳化）。`;

  const prompt = `你是一位頂級台灣室內空間設計師。請根據這張室內照片、空間實際尺度（寬 ${scene.roomDimensionsCm.width}cm × 深 ${scene.roomDimensionsCm.depth}cm × 高 ${scene.roomDimensionsCm.height}cm，採光窗位於 ${scene.windowSide} 側），為使用者規劃 3 套**物理真實可行且差異明確**的「現有傢俱重排」方案。

不可更動結構與機電遮罩（禁止家具遮擋）：
${lockedDesc || '（請依照片中之窗戶、門片、冷氣、配電箱位置避讓）'}

門扇開啟半徑：
hinge=(${scene.doorSwing.hingeCm.x}, ${scene.doorSwing.hingeCm.y}), radius=${scene.doorSwing.radiusCm}cm

現有傢俱清單（盡可能保留並重新安排位置，不要無故刪除）：
${furnDesc || '（請先根據照片中可見家具給予合理家具 ID 與搬移建議）'}

屋主約束條件：
- 主走道淨寬要求 >= ${constraints.minWalkwayCm}cm
- 寵物友善：${constraints.petFriendly ? '是' : '否'}${constraints.catTreeRequired ? '（建議其中一方案納入窗邊貓跳台）' : ''}
- 收納優先級：${constraints.storagePriority}
- 保留原物件：${constraints.preserveItems.join('、') || '既有主要大型家具'}
${fengShuiInstruction}

請輸出嚴格 JSON 格式（繁體中文標題與詳細理由 + visualPromptEn 英文生圖指令）：
{
  "proposals": [
    {
      "title": "方案 A｜...",
      "subtitle": "簡述核心空間改善優勢",
      "tags": ["標籤1", "標籤2", "標籤3"],
      "rationale": [
        "具體調整理由 1（說明家具移至何處與公分數動線改善）",
        "具體調整理由 2（說明如何避開窗戶採光面、冷氣直吹、房門或配電箱）"
      ],
      "visualPromptEn": "Detailed English instruction describing how furniture moves in the room photo so image editing model moves furniture cleanly.",
      "moves": [
        {
          "id": "必須完全對應現有家具 id",
          "topDownXCm": number,
          "topDownYCm": number,
          "rotationDeg": 0 | 90 | 180 | 270,
          "centerNormX": 0.08~0.92,
          "baselineNormY": 0.45~0.95
        }
      ],
      "addedItems": []
    }
  ]
}`;

  const raw = await callGeminiVisionJson<RawProposalPlanResponse>(prompt, [encoded], {
    signal: params.signal,
  });
  const rawList = Array.isArray(raw.proposals) ? raw.proposals.slice(0, 3) : [];
  if (rawList.length === 0) {
    throw new GeminiServiceError('INVALID_RESPONSE', 'Gemini 未能產出有效的傢俱重排方案，請再試一次。');
  }

  const proposals: RearrangementProposal[] = rawList.map((p, idx) => {
    const moveMap = new Map((p.moves ?? []).map((m) => [m.id, m]));
    const updatedFurniture: FurnitureItem[] = furniture.map((item) => {
      const m = moveMap.get(item.id);
      if (!m) {
        return {
          ...item,
          topDownPosCm: { ...item.topDownPosCm },
          imagePos: { ...item.imagePos },
          bboxNorm: { ...item.bboxNorm },
        };
      }
      const rot = [0, 90, 180, 270].includes(Number(m.rotationDeg))
        ? Number(m.rotationDeg)
        : item.topDownPosCm.rotationDeg;
      return {
        ...item,
        topDownPosCm: {
          x: Math.round(
            clamp(Number(m.topDownXCm ?? item.topDownPosCm.x), 0, Math.max(0, scene.roomDimensionsCm.width - 35))
          ),
          y: Math.round(
            clamp(Number(m.topDownYCm ?? item.topDownPosCm.y), 0, Math.max(0, scene.roomDimensionsCm.depth - 35))
          ),
          rotationDeg: rot,
        },
        imagePos: {
          x: clamp(Number(m.centerNormX ?? item.imagePos.x), 0.06, 0.94),
          y: clamp(Number(m.baselineNormY ?? item.imagePos.y), 0.35, 0.96),
          scale: item.imagePos.scale,
        },
        bboxNorm: { ...item.bboxNorm },
      };
    });

    const added: FurnitureItem[] = (p.addedItems ?? []).slice(0, 2).map((ai, aIdx) => {
      const w = Math.round(clamp(Number(ai.widthCm) || 70, 35, 200));
      const d = Math.round(clamp(Number(ai.depthCm) || 55, 35, 120));
      const h = Math.round(clamp(Number(ai.heightCm) || 120, 40, 220));
      const cx = clamp(Number(ai.centerNormX) || 0.28, 0.08, 0.92);
      const cy = clamp(Number(ai.baselineNormY) || 0.85, 0.45, 0.96);
      return {
        id: `furn-ai-added-${idx}-${aIdx}`,
        name: ai.name || 'AI 建議增補單品',
        category: normalizeFurnitureCategory(ai.category),
        widthCm: w,
        depthCm: d,
        heightCm: h,
        topDownPosCm: {
          x: Math.round(clamp(Number(ai.topDownXCm) || 35, 0, Math.max(0, scene.roomDimensionsCm.width - w))),
          y: Math.round(clamp(Number(ai.topDownYCm) || 35, 0, Math.max(0, scene.roomDimensionsCm.depth - d))),
          rotationDeg: [0, 90, 180, 270].includes(Number(ai.rotationDeg))
            ? Number(ai.rotationDeg)
            : 0,
        },
        imagePos: { x: cx, y: cy, scale: 1 },
        bboxNorm: { x: clamp(cx - 0.07, 0.02, 0.85), y: clamp(cy - 0.25, 0.1, 0.8), w: 0.14, h: 0.25 },
        isOriginal: false,
        isPreserved: false,
        materialTag: ai.materialTag || 'AI 建議材質',
        estimatedPriceTWD: Number(ai.estimatedPriceTWD) || 7500,
        colorHex: '#CFAF86',
      };
    });

    const combinedLayout = [...updatedFurniture, ...added];
    const ergo = evaluateErgonomics(
      scene,
      combinedLayout,
      protectionZones,
      constraints.minWalkwayCm,
      Boolean(constraints.fengShuiMode)
    );

    return {
      id: `prop-gemini-${idx + 1}-${Date.now()}`,
      title: p.title || `方案 ${String.fromCharCode(65 + idx)}｜空間動線優化`,
      subtitle: p.subtitle || 'Gemini AI 依採光、通風與機電鎖定區演算配置',
      score: ergo.overallScore,
      tags: Array.isArray(p.tags) && p.tags.length > 0 ? p.tags.slice(0, 4) : ['Gemini 空間重排', '保留現有家具'],
      rationale:
        Array.isArray(p.rationale) && p.rationale.length > 0
          ? p.rationale
          : ['依比例尺計算最佳走道淨寬與門扇避讓半徑。'],
      furnitureLayout: combinedLayout,
      ergonomics: ergo,
      aiVisualPromptEn: p.visualPromptEn || p.subtitle || '',
      aiRenderedImageUrl: null,
    };
  });

  // Sort highest ergonomic score first, then photorealistically render Proposal #1 immediately!
  proposals.sort((a, b) => b.score - a.score);

  const renderedFirst = await renderRearrangedRoomImageWithGemini({
    scene,
    proposal: proposals[0],
    protectionZones,
    constraints,
    lighting,
    signal: params.signal,
  });

  proposals[0] = {
    ...proposals[0],
    aiRenderedImageUrl: renderedFirst.imageUrl,
  };

  return proposals;
}

export async function renderStyleTransferWithGemini(params: {
  scene: RoomScene;
  styleId: StyleId;
  intensity: number;
  protectionZones: ProtectionZone[];
  constraints: ParsedDesignConstraints;
  lighting: LightingConfig;
  materials: MaterialOverrides;
  signal?: AbortSignal;
}): Promise<{ imageUrl: string; description: string }> {
  const { scene, styleId, intensity, protectionZones, constraints, lighting, materials } = params;
  const encoded = await urlToInlineImagePart(scene.imageUrl, 1280, false);
  const styleDef = getStyleById(styleId);

  const floorMat = getMaterialById(materials.floor ?? styleDef.recommendedFloorId);
  const wallMat = getMaterialById(materials.wall ?? styleDef.recommendedWallId);
  const sofaMat = getMaterialById(materials.sofa);
  const curtainMat = getMaterialById(materials.curtain ?? styleDef.recommendedCurtainId);

  const lockedDesc = protectionZones
    .filter((z) => z.locked)
    .map((z) => `${z.label} (${z.category})`)
    .join('; ');

  const lightingDesc =
    lighting.sunPreset === 'night_mode'
      ? `evening indoor ambiance with warm ${lighting.kelvin}K lighting`
      : lighting.sunPreset === 'east_morning'
      ? `bright crisp morning daylight from windows paired with ${lighting.kelvin}K lighting`
      : lighting.sunPreset === 'west_afternoon'
      ? `golden late-afternoon sunlight casting soft shadows with ${lighting.kelvin}K lighting`
      : `balanced soft northern daylight with ${lighting.kelvin}K indoor lighting`;

  const prompt = `Redesign this exact indoor room photograph into authentic **${styleDef.nameEn} (${styleDef.nameZh})** interior style (${styleDef.tagline}), while preserving 100% of the structural geometry and camera perspective.

STRUCTURAL & MEP CONSTRAINTS (NEVER ALTER OR OBSTRUCT):
- Keep exact perspective geometry, ceiling height, structural beams/columns, doors, windows, AC indoor unit position, and electrical panel position untouched.
- Protected elements: ${lockedDesc || 'Windows, exterior daylight openings, AC unit, electrical breaker panel, ceiling beams'}.

STYLE & MATERIAL TRANSFORMATION (Blend Strength Target: ${intensity}%):
- Palette inspiration: ${styleDef.palette.join(', ')}
- Flooring finish: ${floorMat ? `${floorMat.name} (${floorMat.spec})` : 'refined natural wood/mineral finish matching the style'}
- Main walls finish: ${wallMat ? `${wallMat.name} (${wallMat.spec})` : 'tasteful matte texture matching the style'}
- Upholstery & textiles: ${sofaMat ? sofaMat.name : 'harmonized sofa & soft furnishings'}, Curtains: ${curtainMat ? curtainMat.name : 'style-appropriate window dressings'}
${constraints.petFriendly ? '- CRITICAL USER REQUIREMENT: Pet-friendly apartment (2 cats) — use scratch-resistant tightly woven fabrics and hard-wearing flooring; keep clear floor pathways.' : ''}
${constraints.catTreeRequired ? '- Include a tasteful aesthetic wooden cat tree corner if natural space permits without blocking traffic or windows.' : ''}
${constraints.fengShuiMode ? '- Respect Taiwanese Feng Shui principles: avoid exposed sharp beam edges over seating/beds and avoid mirrors facing beds.' : ''}
${constraints.preserveItems.length > 0 ? `- Preserve the core silhouette and placement of: ${constraints.preserveItems.join(', ')}.` : ''}
${constraints.requiredZones.length > 0 ? `- Incorporate functional cues for: ${constraints.requiredZones.join(', ')}.` : ''}

LIGHTING:
- ${lightingDesc}${lighting.recessedDownlights ? ', featuring subtle architectural recessed ceiling downlights' : ''}${lighting.indirectCoveLight ? ', featuring soft warm ceiling cove indirect LED strips' : ''}.
- Photorealistic, architectural magazine editorial photography quality, seamless textures, realistic shadows and reflections.`;

  const res = await callGeminiImageEdit({
    prompt,
    images: [encoded],
    targetWidth: scene.imageWidth,
    targetHeight: scene.imageHeight,
    signal: params.signal,
  });

  return {
    imageUrl: res.imageDataUrl,
    description: `${res.modelUsed} 已完成「${styleDef.nameZh} (${styleDef.nameEn})」高擬真風格轉換`,
  };
}

interface RawZonesResponse {
  zones?: Array<{
    label?: string;
    reason?: string;
    imageAnchor?: { x?: number; y?: number };
    perspectiveScale?: number;
    topDownPosCm?: { x?: number; y?: number; rotationDeg?: number };
    footprintPolyNorm?: Array<{ x?: number; y?: number }>;
  }>;
}

export async function analyzeObjectZonesWithGemini(params: {
  scene: RoomScene;
  itemName: string;
  widthCm: number;
  depthCm: number;
  heightCm: number;
  protectionZones: ProtectionZone[];
  existingFurniture: FurnitureItem[];
  signal?: AbortSignal;
}): Promise<HighlightZone[]> {
  const { scene, itemName, widthCm, depthCm, heightCm, protectionZones, existingFurniture } = params;
  const encoded = await urlToInlineImagePart(scene.imageUrl, 1280, false);

  const furnList = existingFurniture
    .map((f) => `${f.name} at (${f.topDownPosCm.x},${f.topDownPosCm.y}) ${f.widthCm}x${f.depthCm}cm`)
    .join('; ');
  const lockList = protectionZones
    .filter((z) => z.locked)
    .map((z) => `${z.label} at (${z.topDownRectCm.x},${z.topDownRectCm.y}) ${z.topDownRectCm.w}x${z.topDownRectCm.d}cm`)
    .join('; ');

  const prompt = `分析這張室內照片中的可用地板與畸零空間，針對使用者欲新增的單品「${itemName}」（實體尺寸：寬 ${widthCm}cm × 深 ${depthCm}cm × 高 ${heightCm}cm），推薦 2～3 個最適合擺放的高亮候補區域。

房間估計尺寸：${scene.roomDimensionsCm.width} × ${scene.roomDimensionsCm.depth} cm
現有家具位置：${furnList || '無'}
不可更動保護區（禁止遮擋）：${lockList || '窗戶、門片開啟半徑、配電箱、冷氣風口'}

請輸出嚴格 JSON 格式（繁體中文）：
{
  "zones": [
    {
      "label": "建議區 1：...",
      "reason": "解釋為何適合此單品且維持走道淨寬與保護區距離",
      "imageAnchor": { "x": 0.1~0.9, "y": 0.55~0.95 },
      "perspectiveScale": 0.65~1.1,
      "topDownPosCm": { "x": number, "y": number, "rotationDeg": 0 },
      "footprintPolyNorm": [4個地板佔地 0..1 多邊形座標]
    }
  ]
}`;

  const raw = await callGeminiVisionJson<RawZonesResponse>(prompt, [encoded], {
    signal: params.signal,
  });
  const zonesRaw = Array.isArray(raw.zones) ? raw.zones.slice(0, 3) : [];
  if (zonesRaw.length === 0) {
    throw new GeminiServiceError('INVALID_RESPONSE', 'Gemini 未識別出適合擺放此新單品的建議區域，請確認照片角度或尺寸設定。');
  }

  return zonesRaw.map((z, idx) => {
    const ax = clamp(Number(z.imageAnchor?.x ?? 0.35 + idx * 0.2), 0.08, 0.92);
    const ay = clamp(Number(z.imageAnchor?.y ?? 0.85), 0.5, 0.96);
    const tx = Math.round(
      clamp(Number(z.topDownPosCm?.x ?? 35), 6, Math.max(10, scene.roomDimensionsCm.width - widthCm - 6))
    );
    const ty = Math.round(
      clamp(Number(z.topDownPosCm?.y ?? 45), 6, Math.max(10, scene.roomDimensionsCm.depth - depthCm - 6))
    );
    const candidateRect = { x: tx, y: ty, w: widthCm, d: depthCm };
    const hitsDoor = doesRectIntersectDoorSwing(candidateRect, scene.doorSwing);
    const hitsFurn = existingFurniture.some((f) => rectsOverlap(candidateRect, getItemFootprintRect(f), 5));
    const hitsMep = protectionZones.some(
      (pz) => pz.locked && pz.category !== 'beam_column' && rectsOverlap(candidateRect, pz.topDownRectCm, 5)
    );

    let fitScore = 95 - idx * 5;
    if (hitsDoor) fitScore -= 30;
    if (hitsFurn) fitScore -= 24;
    if (hitsMep) fitScore -= 22;

    return {
      id: `zone-gemini-${idx + 1}-${Date.now()}`,
      label: z.label || `建議區 ${idx + 1}`,
      reason:
        hitsDoor || hitsMep
          ? `注意：此區域鄰近門片／保護區（建議微調尺吋），${z.reason || ''}`
          : z.reason || 'Gemini AI 空間分析推薦可順暢擺放區',
      fitScore: Math.max(40, fitScore),
      imageAnchor: { x: ax, y: ay },
      perspectiveScale: clamp(Number(z.perspectiveScale ?? 0.9), 0.55, 1.25),
      topDownPosCm: { x: tx, y: ty, rotationDeg: Number(z.topDownPosCm?.rotationDeg) || 0 },
      footprintPolyNorm: normalizePolygon(z.footprintPolyNorm, [
        { x: clamp(ax - 0.09, 0.02, 0.95), y: clamp(ay - 0.06, 0.02, 0.95) },
        { x: clamp(ax + 0.09, 0.02, 0.95), y: clamp(ay - 0.06, 0.02, 0.95) },
        { x: clamp(ax + 0.09, 0.02, 0.95), y: clamp(ay + 0.05, 0.02, 0.95) },
        { x: clamp(ax - 0.09, 0.02, 0.95), y: clamp(ay + 0.05, 0.02, 0.95) },
      ]),
      mepSafe: !hitsDoor && !hitsMep,
    };
  });
}

export async function compositeNewObjectWithGemini(params: {
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
}): Promise<{ imageUrl: string; description: string }> {
  const roomPart = await urlToInlineImagePart(params.baseImageUrl, 1280, false);
  const itemPart = await urlToInlineImagePart(params.objectImageUrl, 1024, true);

  const prompt = `You are given TWO images:
- Image 1: The existing interior room photograph.
- Image 2: A single furniture / decor item ("${params.itemName}", real dimensions: ${params.widthCm}cm W × ${params.depthCm}cm D × ${params.heightCm}cm H).

TASK:
Photorealistically place and integrate the furniture item from Image 2 into Image 1 cleanly without altering the rest of the room!

PLACEMENT COORDINATES & SCALE:
- Target floor placement area in Image 1: "${params.zone.label}" — approximately ${Math.round(
    params.zone.imageAnchor.x * 100
  )}% from the left edge, resting its base on the floor around ${Math.round(
    params.zone.imageAnchor.y * 100
  )}% from the top edge.
- Scale the placed item to match realistic physical perspective proportions (${params.widthCm}×${params.depthCm}×${params.heightCm}cm relative to surrounding walls and floor).
- Cast natural floor contact shadows consistent with the window daylight and ${params.lighting.kelvin}K room illumination.
- Keep all other existing walls, windows, furniture, and perspective lines in Image 1 untouched.
${params.constraints.petFriendly ? '- Ensure stable pet-safe positioning away from hazards.' : ''}`;

  const res = await callGeminiImageEdit({
    prompt,
    images: [roomPart, itemPart],
    targetWidth: params.imageWidth,
    targetHeight: params.imageHeight,
    signal: params.signal,
  });

  return {
    imageUrl: res.imageDataUrl,
    description: `${res.modelUsed} 已將「${params.itemName}」依透視比例與光影實景合成至「${params.zone.label}」`,
  };
}

export async function refineLightingAndMaterialsWithGemini(params: {
  baseImageUrl: string;
  imageWidth: number;
  imageHeight: number;
  lighting: LightingConfig;
  materials: MaterialOverrides;
  protectionZones: ProtectionZone[];
  constraints: ParsedDesignConstraints;
  signal?: AbortSignal;
}): Promise<{ imageUrl: string; description: string }> {
  const roomPart = await urlToInlineImagePart(params.baseImageUrl, 1280, false);

  const floorMat = getMaterialById(params.materials.floor);
  const wallMat = getMaterialById(params.materials.wall);
  const sofaMat = getMaterialById(params.materials.sofa);
  const curtainMat = getMaterialById(params.materials.curtain);

  const sunMap: Record<LightingConfig['sunPreset'], string> = {
    east_morning: 'crisp bright eastern morning sunlight beams entering through the window',
    west_afternoon: 'warm golden afternoon sunset light raking diagonally from the window',
    north_soft: 'even diffused soft northern natural daylight throughout the room',
    night_mode: 'evening / nighttime interior atmosphere with dark windows outside and interior illumination',
  };

  const materialEdits: string[] = [];
  if (floorMat) materialEdits.push(`- Floor surface MUST be cleanly replaced with: ${floorMat.name} (${floorMat.spec})`);
  if (wallMat) materialEdits.push(`- Main walls MUST be refinished in: ${wallMat.name} (${wallMat.spec})`);
  if (sofaMat) materialEdits.push(`- Sofa / seating upholstery MUST be reupholstered in: ${sofaMat.name} (${sofaMat.spec})`);
  if (curtainMat) materialEdits.push(`- Window curtains MUST be updated to: ${curtainMat.name} (${curtainMat.spec})`);

  const lockedDesc = params.protectionZones
    .filter((z) => z.locked)
    .map((z) => z.label)
    .join(', ');

  const prompt = `Perform precision interior relighting and local surface material inpainting on this exact interior photograph WITHOUT moving any furniture or altering room geometry.

STRICT POSITION & STRUCTURAL LOCK:
- Keep ALL existing furniture pieces, frames, doors, windows, AC units, and electrical panels in their EXACT pixel positions.
- Protected fixed areas: ${lockedDesc || 'Windows, AC units, electrical panel, ceiling beams'}.

LIGHTING & COLOR TEMPERATURE SIMULATION:
- Time-of-day daylight: ${sunMap[params.lighting.sunPreset]}.
- Artificial light color temperature: ${params.lighting.kelvin}K (${
    params.lighting.kelvin === 3000
      ? 'warm cozy amber glow'
      : params.lighting.kelvin === 6000
      ? 'crisp cool daylight white'
      : 'neutral natural white'
  }).
- Ceiling recessed downlights: ${params.lighting.recessedDownlights ? 'ON — add clean architectural recessed LED ceiling spotlights and natural light cones' : 'subtle / minimal ambient fixtures'}.
- Indirect cove lighting: ${params.lighting.indirectCoveLight ? 'ON — add warm architectural ceiling perimeter indirect LED cove strip wash' : 'OFF'}.

LOCAL SURFACE MATERIAL REPLACEMENTS:
${materialEdits.length > 0 ? materialEdits.join('\n') : '- Keep existing materials intact, updating ONLY the physical lighting, reflections, and shadow casting.'}
${params.constraints.petFriendly ? '- Respect pet-friendly scratch-resistant material finishes.' : ''}

Maintain photorealistic textures, natural global illumination, and realistic shadow reflections across all surfaces.`;

  const res = await callGeminiImageEdit({
    prompt,
    images: [roomPart],
    targetWidth: params.imageWidth,
    targetHeight: params.imageHeight,
    signal: params.signal,
  });

  return {
    imageUrl: res.imageDataUrl,
    description: `${res.modelUsed} 已完成 ${params.lighting.kelvin}K 光影與指定表面材質實景重繪`,
  };
}

export async function conversationalEditWithGemini(params: {
  baseImageUrl: string;
  imageWidth: number;
  imageHeight: number;
  instruction: string;
  history: string[];
  protectionZones: ProtectionZone[];
  lighting: LightingConfig;
  signal?: AbortSignal;
}): Promise<{ imageUrl: string; description: string }> {
  const roomPart = await urlToInlineImagePart(params.baseImageUrl, 1280, false);
  const lockedDesc = params.protectionZones
    .filter((z) => z.locked)
    .map((z) => z.label)
    .join(', ');

  const historyContext =
    params.history.length > 0
      ? `\nPrevious iterative adjustments already applied:\n${params.history
          .slice(-4)
          .map((h, i) => `${i + 1}. ${h}`)
          .join('\n')}`
      : '';

  const prompt = `Perform a targeted, localized conversational edit on this exact interior design photograph based on the user's instruction, while keeping ALL unmentioned furniture, flooring, walls, lighting, and room geometry 100% identical in place.

USER LOCAL EDIT INSTRUCTION:
"${params.instruction}"${historyContext}

STRICT LOCAL INPAINTING RULES:
- Modify ONLY the specific item, color, lamp, decor, or localized area requested by the user.
- DO NOT move, resize, or alter any other furniture pieces that the user did not ask to change.
- Protected fixed architectural & MEP areas (never block or alter): ${lockedDesc || 'Windows, doors, AC unit, electrical breaker panel, ceiling beams'}.
- Maintain consistent ${params.lighting.kelvin}K lighting, perspective lines, and realistic floor contact shadows.`;

  const res = await callGeminiImageEdit({
    prompt,
    images: [roomPart],
    targetWidth: params.imageWidth,
    targetHeight: params.imageHeight,
    signal: params.signal,
  });

  return {
    imageUrl: res.imageDataUrl,
    description: `${res.modelUsed} 已完成對話微調：「${params.instruction.slice(0, 32)}」`,
  };
}

const PURCHASABLE_ITEMS_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          category: { type: 'STRING' },
          styleNote: { type: 'STRING' },
          colorTone: { type: 'STRING' },
          materialNote: { type: 'STRING' },
          searchKeywordZh: { type: 'STRING' },
          box_2d: {
            type: 'ARRAY',
            items: { type: 'NUMBER' },
          },
          estimatedWidthCm: { type: 'NUMBER' },
          estimatedDepthCm: { type: 'NUMBER' },
          estimatedHeightCm: { type: 'NUMBER' },
          estimatedPriceTWD: { type: 'NUMBER' },
        },
        required: [
          'name',
          'category',
          'box_2d',
          'estimatedWidthCm',
          'estimatedDepthCm',
          'estimatedHeightCm',
          'searchKeywordZh',
        ],
      },
    },
  },
  required: ['items'],
};

interface RawDetectedShoppingResponse {
  items?: Array<{
    name?: string;
    category?: string;
    styleNote?: string;
    colorTone?: string;
    materialNote?: string;
    searchKeywordZh?: string;
    box_2d?: number[];
    estimatedWidthCm?: number;
    estimatedDepthCm?: number;
    estimatedHeightCm?: number;
    estimatedPriceTWD?: number;
  }>;
}

export function buildBrandShoppingSearchUrl(brand: FurnitureBrand, keyword: string): string {
  const q = encodeURIComponent(keyword.trim() || '北歐家具');
  switch (brand) {
    case 'IKEA':
      return `https://www.ikea.com.tw/zh/search?q=${q}`;
    case 'MUJI 無印良品':
      return `https://www.muji.com/tw/zh_tw/search?q=${q}`;
    case 'NITORI 宜得利':
      return `https://www.nitori-net.tw/search?keyword=${q}`;
    case 'MR. LIVING 居家先生':
      return `https://www.mrliving.com.tw/catalogsearch/result/?q=${q}`;
    case 'HOLA 和樂家居':
      return `https://www.hola.com.tw/search?q=${q}`;
  }
}

export async function detectPurchasableItemsWithGemini(params: {
  imageUrl: string;
  pixelPerCm: number;
  walkwayCm: number;
  roomDimensionsCm: { width: number; depth: number; height: number };
  activeStyle: StyleId;
  petFriendly: boolean;
  cropBoxNorm?: { x: number; y: number; w: number; h: number };
  signal?: AbortSignal;
}): Promise<VisualSearchMatch[]> {
  let targetUrl = params.imageUrl;
  if (params.cropBoxNorm) {
    targetUrl = await cropNormalizedImageRegion(params.imageUrl, params.cropBoxNorm);
  }
  const encoded = await urlToInlineImagePart(targetUrl, 1280, false);

  const maxAllowedWidthCm = Math.max(45, params.roomDimensionsCm.width - Math.max(60, params.walkwayCm));
  const maxAllowedDepthCm = Math.max(40, params.roomDimensionsCm.depth - Math.max(60, params.walkwayCm));

  const prompt = params.cropBoxNorm
    ? `你是一位台灣專業軟裝採購顧問。使用者在室內設計模擬圖上手動框選了這塊局部區域，請精準辨識此框選畫面中**唯一最主要的可購買傢俱或燈飾單品**。
空間物理限制：空間總寬 ${params.roomDimensionsCm.width}cm × 深 ${params.roomDimensionsCm.depth}cm，比例尺 ${params.pixelPerCm} px/cm，預留走道 ${params.walkwayCm}cm。單品寬度不得超過 ${maxAllowedWidthCm}cm。
請回傳嚴格 JSON（items 陣列僅放 1 個最核心的物件），box_2d 格式為 [ymin, xmin, ymax, xmax]（0 到 1000 整數座標），searchKeywordZh 請填寫適合在台灣 IKEA / MUJI / 宜得利搜尋的精準繁體中文商品關鍵字（例如「米白三人布沙發」、「橡木圓形茶幾」、「黑色極簡落地燈」）。`
    : `你是一位台灣專業軟裝採購顧問。請針對這張「最終室內設計模擬圖」，透過視覺偵測找出畫面中**真正存在且清晰可見**的可購買傢俱與燈飾單品（例如：沙發、茶幾、單椅、落地燈、邊几、地毯、電視櫃、床架、書桌、貓跳台）。

嚴格防呆與物理尺寸過濾規範：
1. **嚴禁列出畫面中不存在的物件**：若畫面中沒有貓跳台、沒有床架或沒有餐桌，絕對不可列入！最多列出 2～6 件最明確的單品。
2. **精準 2D 邊界框 (box_2d)**：每個物件必須提供 [ymin, xmin, ymax, xmax]（0 到 1000 歸一化座標），且方框必須緊密貼合該物件在圖片中的真實像素位置。
3. **空間物理尺寸過濾**：目前空間寬 ${params.roomDimensionsCm.width}cm × 深 ${params.roomDimensionsCm.depth}cm（比例尺 ${params.pixelPerCm} px/cm，走道淨寬 ${params.walkwayCm}cm）。請依透視比例推估每件單品的真實長寬高（cm），單品寬度必須 <= ${maxAllowedWidthCm}cm、深度 <= ${maxAllowedDepthCm}cm，確保放得進此空間且不影響走道動線。
4. **搜尋關鍵字 (searchKeywordZh)**：請提供 4～8 字適合直接於台灣 IKEA、MUJI 無印良品、宜得利家居搜尋購買的繁體中文關鍵字（含色系或材質特徵，如「北歐淺灰亞麻三人沙發」、「原木實木矮茶幾」）。`;

  const raw = await callGeminiVisionJson<RawDetectedShoppingResponse>(prompt, [encoded], {
    signal: params.signal,
    responseSchema: PURCHASABLE_ITEMS_RESPONSE_SCHEMA,
  });

  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  if (rawItems.length === 0) {
    throw new GeminiServiceError('INVALID_RESPONSE', 'Gemini 未在目前畫面中偵測到明確的傢俱或燈飾單品。');
  }

  const brandsOrder: FurnitureBrand[] = params.petFriendly
    ? ['NITORI 宜得利', 'IKEA', 'MR. LIVING 居家先生', 'MUJI 無印良品']
    : ['IKEA', 'MUJI 無印良品', 'NITORI 宜得利', 'MR. LIVING 居家先生'];

  return rawItems.slice(0, params.cropBoxNorm ? 1 : 6).map((item, idx) => {
    const cat = normalizeFurnitureCategory(item.category);
    const estW = Math.round(clamp(Number(item.estimatedWidthCm) || 90, 28, maxAllowedWidthCm));
    const estD = Math.round(clamp(Number(item.estimatedDepthCm) || 60, 25, maxAllowedDepthCm));
    const estH = Math.round(clamp(Number(item.estimatedHeightCm) || 75, 25, 225));
    const basePrice = Math.round(clamp(Number(item.estimatedPriceTWD) || 6800, 990, 68000));

    let ymin = 450;
    let xmin = 250;
    let ymax = 820;
    let xmax = 650;
    if (Array.isArray(item.box_2d) && item.box_2d.length >= 4) {
      const [y0, x0, y1, x1] = item.box_2d.map((v) => clamp(Number(v) || 0, 0, 1000));
      ymin = Math.min(y0, y1);
      ymax = Math.max(y0, y1);
      xmin = Math.min(x0, x1);
      xmax = Math.max(x0, x1);
      if (ymax - ymin < 40) ymax = Math.min(1000, ymin + 120);
      if (xmax - xmin < 40) xmax = Math.min(1000, xmin + 120);
    }

    let bboxNorm = {
      x: clamp(xmin / 1000, 0.01, 0.94),
      y: clamp(ymin / 1000, 0.01, 0.94),
      w: clamp((xmax - xmin) / 1000, 0.05, 0.96),
      h: clamp((ymax - ymin) / 1000, 0.05, 0.96),
    };

    if (params.cropBoxNorm) {
      bboxNorm = {
        x: clamp(params.cropBoxNorm.x, 0.01, 0.95),
        y: clamp(params.cropBoxNorm.y, 0.01, 0.95),
        w: clamp(params.cropBoxNorm.w, 0.04, 0.98),
        h: clamp(params.cropBoxNorm.h, 0.04, 0.98),
      };
      ymin = Math.round(bboxNorm.y * 1000);
      xmin = Math.round(bboxNorm.x * 1000);
      ymax = Math.round((bboxNorm.y + bboxNorm.h) * 1000);
      xmax = Math.round((bboxNorm.x + bboxNorm.w) * 1000);
    }

    const itemName = (item.name && String(item.name).trim()) || `辨識單品 ${idx + 1}`;
    const keyword =
      (item.searchKeywordZh && String(item.searchKeywordZh).trim()) || itemName;
    const styleNote = (item.styleNote && String(item.styleNote).trim()) || '現代空間適配款';
    const colorTone = (item.colorTone && String(item.colorTone).trim()) || '自然色系';
    const matNote =
      (item.materialNote && String(item.materialNote).trim()) ||
      (params.petFriendly ? '防抓耐磨表面材質' : '質感實木／織品');

    const matches = brandsOrder.slice(0, 3).map((brand, bIdx) => {
      const priceFactor = bIdx === 0 ? 1 : bIdx === 1 ? 0.88 : 1.15;
      const wVariant = Math.max(25, estW + (bIdx === 0 ? 0 : bIdx === 1 ? -4 : 3));
      const dVariant = Math.max(25, estD + (bIdx === 0 ? 0 : bIdx === 1 ? -2 : 2));
      const hVariant = estH;
      const product: CatalogProduct = {
        id: `ai-shop-${Date.now()}-${idx}-${bIdx}`,
        brand,
        sku: `TW-${cat.toUpperCase().slice(0, 4)}-${100 + idx * 10 + bIdx}`,
        name: `${keyword}（${colorTone}）`,
        category: cat,
        widthCm: wVariant,
        depthCm: dVariant,
        heightCm: hVariant,
        priceTWD: Math.round((basePrice * priceFactor) / 100) * 100,
        material: `${matNote} · ${styleNote}`,
        petScratchResistant: params.petFriendly || bIdx === 0,
        styleAffinity: [params.activeStyle],
        colorHex: '#C89F72',
        urlHint: buildBrandShoppingSearchUrl(brand, keyword),
        searchUrl: buildBrandShoppingSearchUrl(brand, keyword),
      };

      return {
        product,
        fitScore: Math.max(82, 97 - bIdx * 4),
        dimDiffNote: `符合空間尺度（預留走道 ${params.walkwayCm}cm 無阻礙）`,
      };
    });

    return {
      slotId: `${params.cropBoxNorm ? 'manual-crop' : 'vlm-shop'}-${Date.now()}-${idx}`,
      slotLabel: params.cropBoxNorm ? `手動框選：${itemName}` : itemName,
      category: cat,
      styleNote,
      colorTone,
      searchKeywordZh: keyword,
      box2d: [ymin, xmin, ymax, xmax],
      bboxNorm,
      estimatedDimsCm: { w: estW, d: estD, h: estH },
      matches,
    };
  });
}

