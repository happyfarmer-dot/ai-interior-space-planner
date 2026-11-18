import { loadPref, savePref } from '../utils/nativePlatform';

export const GEMINI_CONFIG_STORAGE_KEY = 'spatialmind_gemini_config_v1';

export interface GeminiModelOption {
  id: string;
  label: string;
  badge: string;
  description: string;
}

export const GEMINI_VISION_MODELS: GeminiModelOption[] = [
  {
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash-Lite',
    badge: '預設推薦',
    description: '高 CP 值極速視覺推理，精準輸出家具座標、結構鎖定區與約束 JSON',
  },
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    badge: '高階空間推理',
    description: '高準確率空間邏輯分析，適合複雜多樑柱或特殊格局重排',
  },
  {
    id: 'gemini-3-flash-preview',
    label: 'Gemini 3 Flash Preview',
    badge: '快速預覽',
    description: '新世代 Flash 預覽多模態視覺模型',
  },
  {
    id: 'gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash-Lite',
    badge: '穩健相容',
    description: '廣受支援的輕量視覺 JSON 解析模型',
  },
];

export const GEMINI_IMAGE_MODELS: GeminiModelOption[] = [
  {
    id: 'gemini-nano-banana-2.1',
    label: 'Nano Banana 2.1 (gemini-nano-banana-2.1)',
    badge: '預設推薦',
    description: 'Google AI Studio 2026 主力原生圖像編輯與室內寫實重繪模型',
  },
  {
    id: 'gemini-3.1-flash-image',
    label: 'Nano Banana 2 (gemini-3.1-flash-image)',
    badge: '主力備援',
    description: '快速多圖參考編輯，支援空間家具移位與單品光影合成',
  },
  {
    id: 'gemini-3.1-flash-lite-image',
    label: 'Nano Banana Lite (gemini-3.1-flash-lite-image)',
    badge: '快速出圖',
    description: '高效率風格套用與即時空間微調出圖',
  },
  {
    id: 'gemini-3-pro-image',
    label: 'Nano Banana Pro (gemini-3-pro-image)',
    badge: '旗艦質感',
    description: '高精細材質肌理、自然採光色溫與複雜景深合成',
  },
];

export const DEFAULT_VISION_MODEL = 'gemini-3.5-flash-lite';
export const DEFAULT_IMAGE_MODEL = 'gemini-nano-banana-2.1';

export interface GeminiRuntimeConfig {
  apiKey: string;
  visionModel: string;
  imageModel: string;
  discoveredModels: string[];
  lastTestedAt: string | null;
}

function getEnvDefaultApiKey(): string {
  try {
    return (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim() || '';
  } catch {
    return '';
  }
}

function getEnvDefaultVisionModel(): string {
  try {
    return (import.meta.env.VITE_GEMINI_VISION_MODEL as string | undefined)?.trim() || DEFAULT_VISION_MODEL;
  } catch {
    return DEFAULT_VISION_MODEL;
  }
}

function getEnvDefaultImageModel(): string {
  try {
    return (import.meta.env.VITE_GEMINI_IMAGE_MODEL as string | undefined)?.trim() || DEFAULT_IMAGE_MODEL;
  } catch {
    return DEFAULT_IMAGE_MODEL;
  }
}

function readSyncInitialConfig(): GeminiRuntimeConfig {
  const fallback: GeminiRuntimeConfig = {
    apiKey: getEnvDefaultApiKey(),
    visionModel: getEnvDefaultVisionModel(),
    imageModel: getEnvDefaultImageModel(),
    discoveredModels: [],
    lastTestedAt: null,
  };

  try {
    if (typeof window === 'undefined') return fallback;
    const raw = window.localStorage.getItem(GEMINI_CONFIG_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<GeminiRuntimeConfig>;
    return {
      apiKey: (parsed.apiKey ?? fallback.apiKey).trim(),
      visionModel: (parsed.visionModel || fallback.visionModel).trim(),
      imageModel: (parsed.imageModel || fallback.imageModel).trim(),
      discoveredModels: Array.isArray(parsed.discoveredModels) ? parsed.discoveredModels : [],
      lastTestedAt: parsed.lastTestedAt ?? null,
    };
  } catch {
    return fallback;
  }
}

let cachedConfig: GeminiRuntimeConfig = readSyncInitialConfig();
const listeners = new Set<(cfg: GeminiRuntimeConfig) => void>();

function notifyListeners(): void {
  for (const fn of listeners) {
    fn(cachedConfig);
  }
}

export function subscribeGeminiConfig(listener: (cfg: GeminiRuntimeConfig) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getGeminiRuntimeConfig(): GeminiRuntimeConfig {
  return cachedConfig;
}

export function hasGeminiApiKey(): boolean {
  return Boolean(cachedConfig.apiKey.trim());
}

export async function updateGeminiRuntimeConfig(
  patch: Partial<GeminiRuntimeConfig>
): Promise<GeminiRuntimeConfig> {
  cachedConfig = {
    ...cachedConfig,
    ...patch,
    apiKey: (patch.apiKey !== undefined ? patch.apiKey : cachedConfig.apiKey).trim(),
    visionModel: (patch.visionModel || cachedConfig.visionModel || DEFAULT_VISION_MODEL).trim(),
    imageModel: (patch.imageModel || cachedConfig.imageModel || DEFAULT_IMAGE_MODEL).trim(),
  };
  await savePref(GEMINI_CONFIG_STORAGE_KEY, JSON.stringify(cachedConfig));
  notifyListeners();
  return cachedConfig;
}

export async function hydrateGeminiConfigFromNativePrefs(): Promise<GeminiRuntimeConfig> {
  const raw = await loadPref(GEMINI_CONFIG_STORAGE_KEY);
  if (!raw) return cachedConfig;
  try {
    const parsed = JSON.parse(raw) as Partial<GeminiRuntimeConfig>;
    cachedConfig = {
      ...cachedConfig,
      apiKey: (parsed.apiKey ?? cachedConfig.apiKey).trim(),
      visionModel: (parsed.visionModel || cachedConfig.visionModel).trim(),
      imageModel: (parsed.imageModel || cachedConfig.imageModel).trim(),
      discoveredModels: Array.isArray(parsed.discoveredModels)
        ? parsed.discoveredModels
        : cachedConfig.discoveredModels,
      lastTestedAt: parsed.lastTestedAt ?? cachedConfig.lastTestedAt,
    };
    notifyListeners();
  } catch {
    // ignore malformed saved preference
  }
  return cachedConfig;
}

export interface GeminiConnectionTestResult {
  ok: boolean;
  message: string;
  discoveredModels: string[];
  visionCandidates: string[];
  imageCandidates: string[];
  suggestedVisionModel?: string;
  suggestedImageModel?: string;
}

export async function testGeminiConnection(
  candidateApiKey: string
): Promise<GeminiConnectionTestResult> {
  const key = candidateApiKey.trim();
  if (!key) {
    return {
      ok: false,
      message: '請先輸入 Gemini API Key。',
      discoveredModels: [],
      visionCandidates: [],
      imageCandidates: [],
    };
  }

  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
      method: 'GET',
      headers: {
        'x-goog-api-key': key,
      },
    });

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const errBody = await res.json();
        if (errBody?.error?.message) {
          detail = errBody.error.message;
        }
      } catch {
        // ignore body parse failure
      }
      return {
        ok: false,
        message:
          res.status === 400 || res.status === 401 || res.status === 403
            ? `API Key 驗證失敗或權限不足：${detail}`
            : `Gemini API 回應異常：${detail}`,
        discoveredModels: [],
        visionCandidates: [],
        imageCandidates: [],
      };
    }

    const data = (await res.json()) as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
    };

    const allModels = (data.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => (m.name ?? '').replace(/^models\//, ''))
      .filter(Boolean);

    const imageCandidates = allModels.filter((name) =>
      /(nano-banana|image)/i.test(name) && !/imagen/i.test(name)
    );
    const visionCandidates = allModels.filter(
      (name) => /gemini/i.test(name) && !/(nano-banana|-image|tts|robotics|embedding)/i.test(name)
    );

    const preferredVisionOrder = GEMINI_VISION_MODELS.map((m) => m.id);
    const preferredImageOrder = GEMINI_IMAGE_MODELS.map((m) => m.id);

    const suggestedVisionModel =
      preferredVisionOrder.find((id) => visionCandidates.includes(id)) ??
      visionCandidates.find((id) => /flash/i.test(id)) ??
      visionCandidates[0];

    const suggestedImageModel =
      preferredImageOrder.find((id) => imageCandidates.includes(id)) ?? imageCandidates[0];

    const nowText = new Date().toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
    });

    await updateGeminiRuntimeConfig({
      apiKey: key,
      discoveredModels: allModels,
      lastTestedAt: nowText,
      ...(suggestedVisionModel ? { visionModel: suggestedVisionModel } : {}),
      ...(suggestedImageModel ? { imageModel: suggestedImageModel } : {}),
    });

    return {
      ok: true,
      message:
        imageCandidates.length > 0
          ? `連線成功！已偵測 ${allModels.length} 個可用模型（含 ${imageCandidates.length} 個原生圖像編輯模型）。`
          : `API Key 連線成功（偵測到 ${allModels.length} 個文字/視覺模型，但此帳號清單未列出原生圖像生成模型，執行生圖時將依序嘗試 Nano Banana 2.1 與 3.1 系列）。`,
      discoveredModels: allModels,
      visionCandidates,
      imageCandidates,
      suggestedVisionModel,
      suggestedImageModel,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: `網路連線失敗：${msg}（請確認手機網路連線正常且未被防火牆阻擋）`,
      discoveredModels: [],
      visionCandidates: [],
      imageCandidates: [],
    };
  }
}

export function getAIServiceConfig() {
  const cfg = getGeminiRuntimeConfig();
  const connected = Boolean(cfg.apiKey);
  return {
    mode: connected ? ('live' as const) : ('mock' as const),
    visionModel: cfg.visionModel,
    imageModel: cfg.imageModel,
    vlmEndpoint: `https://generativelanguage.googleapis.com/v1beta/models/${cfg.visionModel}:generateContent`,
    diffusionEndpoint: `https://generativelanguage.googleapis.com/v1beta/models/${cfg.imageModel}:generateContent`,
    llmEndpoint: `https://generativelanguage.googleapis.com/v1beta/models/${cfg.visionModel}:generateContent`,
  };
}
