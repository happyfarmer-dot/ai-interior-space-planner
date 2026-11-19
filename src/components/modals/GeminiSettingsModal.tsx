import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  GEMINI_IMAGE_MODELS,
  GEMINI_VISION_MODELS,
  testColabConnection,
  testGeminiConnection,
  updateGeminiRuntimeConfig,
  type GeminiConnectionTestResult,
  type ImageBackendMode,
} from '../../services/aiConfig';
import { useDesignStore } from '../../store/useDesignStore';

export const GeminiSettingsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { geminiConfig, aiError, clearAiError } = useDesignStore();

  const [apiKeyDraft, setApiKeyDraft] = useState(geminiConfig.apiKey);
  const [showKey, setShowKey] = useState(false);
  const [visionModel, setVisionModel] = useState(geminiConfig.visionModel);
  const [imageModel, setImageModel] = useState(geminiConfig.imageModel);
  const [imageBackend, setImageBackend] = useState<ImageBackendMode>(geminiConfig.imageBackend ?? 'gemini');
  const [colabApiUrl, setColabApiUrl] = useState(geminiConfig.colabApiUrl ?? '');
  const [testingColab, setTestingColab] = useState(false);
  const [colabTestResult, setColabTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<GeminiConnectionTestResult | null>(null);

  const visionChoices = Array.from(
    new Set([
      ...GEMINI_VISION_MODELS.map((m) => m.id),
      ...(testResult?.visionCandidates ?? []),
      ...geminiConfig.discoveredModels.filter(
        (m) => /gemini/i.test(m) && !/(nano-banana|-image|tts|robotics|embedding)/i.test(m)
      ),
    ])
  );

  const imageChoices = Array.from(
    new Set([
      ...GEMINI_IMAGE_MODELS.map((m) => m.id),
      ...(testResult?.imageCandidates ?? []),
      ...geminiConfig.discoveredModels.filter((m) => /(nano-banana|image)/i.test(m)),
    ])
  );

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    clearAiError();
    try {
      const res = await testGeminiConnection(apiKeyDraft);
      setTestResult(res);
      if (res.ok) {
        if (res.suggestedVisionModel) setVisionModel(res.suggestedVisionModel);
        if (res.suggestedImageModel) setImageModel(res.suggestedImageModel);
      }
    } finally {
      setTesting(false);
    }
  };

  const handleTestColab = async () => {
    setTestingColab(true);
    setColabTestResult(null);
    clearAiError();
    try {
      const res = await testColabConnection(colabApiUrl);
      setColabTestResult(res);
    } finally {
      setTestingColab(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateGeminiRuntimeConfig({
        apiKey: apiKeyDraft,
        visionModel,
        imageModel,
        imageBackend,
        colabApiUrl,
      });
      clearAiError();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleClearKey = async () => {
    setApiKeyDraft('');
    setTestResult(null);
    await updateGeminiRuntimeConfig({
      apiKey: '',
      discoveredModels: [],
      lastTestedAt: null,
    });
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gemini-settings-title"
    >
      <div className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[#2F3643] bg-[#16191F] text-slate-200 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#252B35] bg-[#13161B] px-4 sm:px-5 py-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#C89F72]/50 bg-[#C89F72]/15 text-[#E2BE96]">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 id="gemini-settings-title" className="text-sm font-bold text-slate-100">
                Google Gemini AI API 連線與生圖模型設定
              </h2>
              <p className="text-[11px] text-slate-400">
                支援真實室景家具重排（Nano Banana 2.1）、多元風格轉換、物件合成與採光重繪
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉 Gemini 設定視窗"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5 text-xs">
          {/* Contextual trigger error if user tried an AI feature before setting key */}
          {aiError && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/45 bg-amber-500/12 p-3 text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div className="space-y-1">
                <p className="font-semibold">提示訊息</p>
                <p className="text-[11px] leading-relaxed">{aiError.message}</p>
              </div>
            </div>
          )}

          {/* Image Generation Backend Switcher: Gemini vs Custom Colab */}
          <div className="space-y-2.5 rounded-xl border border-[#282E39] bg-[#111419] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-[#E2BE96]">生圖引擎來源（圖片生成額度）</span>
              <span className="rounded bg-[#C89F72]/15 px-1.5 py-0.5 text-[10px] text-[#E2BE96]">
                支援自有 Colab 免費／Pro 額度
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setImageBackend('gemini')}
                className={`rounded-lg border p-2.5 text-left transition cursor-pointer ${
                  imageBackend === 'gemini'
                    ? 'border-[#C89F72] bg-[#C89F72]/15 text-slate-100'
                    : 'border-[#282E39] bg-[#16191F] text-slate-400 hover:text-slate-200'
                }`}
              >
                <p className="font-bold text-xs">Google Gemini 官方 API</p>
                <p className="mt-0.5 text-[10.5px] opacity-80">Nano Banana 2.1 雲端生圖</p>
              </button>
              <button
                type="button"
                onClick={() => setImageBackend('colab')}
                className={`rounded-lg border p-2.5 text-left transition cursor-pointer ${
                  imageBackend === 'colab'
                    ? 'border-emerald-400 bg-emerald-500/15 text-slate-100'
                    : 'border-[#282E39] bg-[#16191F] text-slate-400 hover:text-slate-200'
                }`}
              >
                <p className="font-bold text-xs">我的 Google Colab GPU</p>
                <p className="mt-0.5 text-[10.5px] opacity-80">ngrok / Tunnel 自訂 API 網址</p>
              </button>
            </div>

            {imageBackend === 'colab' && (
              <div className="space-y-2 rounded-lg border border-emerald-500/35 bg-emerald-950/20 p-2.5">
                <label
                  htmlFor="colab-api-url-input"
                  className="block text-[11px] font-semibold text-emerald-300"
                >
                  Colab 公開 API 網址（將呼叫 POST /api/generate）
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    id="colab-api-url-input"
                    type="url"
                    value={colabApiUrl}
                    onChange={(e) => setColabApiUrl(e.target.value)}
                    placeholder="https://xxxx-xx-xx.ngrok-free.app"
                    className="min-w-0 flex-1 rounded-lg border border-[#2D3442] bg-[#0B0D10] px-3 py-1.5 font-mono-num text-xs text-slate-100 placeholder:text-slate-600 focus:border-emerald-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={testingColab || !colabApiUrl.trim()}
                    onClick={handleTestColab}
                    className="shrink-0 rounded-lg border border-emerald-500/45 bg-emerald-500/20 px-2.5 py-1.5 text-[11px] font-bold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-40 cursor-pointer"
                  >
                    {testingColab ? '測試中...' : '測試連線'}
                  </button>
                </div>
                {colabTestResult && (
                  <p
                    className={`text-[11px] font-medium ${
                      colabTestResult.ok ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {colabTestResult.ok ? '✓ ' : '⚠ '}
                    {colabTestResult.message}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* API Key Input */}
          <div className="space-y-2 rounded-xl border border-[#282E39] bg-[#111419] p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="gemini-api-key-input"
                className="flex items-center gap-1.5 font-semibold text-[#E2BE96]"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Gemini API Key（Google AI Studio）
              </label>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-sky-400 hover:underline"
              >
                前往申請或複製 API Key
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <input
                  id="gemini-api-key-input"
                  type={showKey ? 'text' : 'password'}
                  value={apiKeyDraft}
                  onChange={(e) => setApiKeyDraft(e.target.value)}
                  placeholder="貼上 AIzaSy... 開頭的 Gemini API Key"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-lg border border-[#2D3442] bg-[#0B0D10] py-2 pl-3 pr-9 font-mono-num text-xs text-slate-100 placeholder:text-slate-600 focus:border-[#C89F72] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  aria-label={showKey ? '隱藏 API Key' : '顯示 API Key'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              {apiKeyDraft && (
                <button
                  type="button"
                  onClick={handleClearKey}
                  title="清除儲存的金鑰"
                  className="rounded-lg border border-[#2D3442] bg-[#181C22] p-2 text-slate-400 hover:border-rose-500/50 hover:text-rose-400 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <p className="text-[10.5px] text-slate-400">
                金鑰僅儲存於您的手機本機 App 安全偏好設定（直連 Google AI，不經過任何第三方中繼伺服器）。
              </p>
              <button
                type="button"
                disabled={testing || !apiKeyDraft.trim()}
                onClick={handleTest}
                className="flex items-center gap-1.5 rounded-lg border border-sky-500/45 bg-sky-500/15 px-3 py-1.5 text-[11px] font-bold text-sky-200 hover:bg-sky-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                {testing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                測試連線並自動探索可用模型
              </button>
            </div>

            {/* Live Connection Test Output */}
            {testResult && (
              <div
                role="status"
                className={`mt-2 rounded-lg border p-2.5 text-[11px] ${
                  testResult.ok
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                    : 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  {testResult.ok ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                  )}
                  <div className="space-y-1.5">
                    <p className="font-semibold">{testResult.message}</p>
                    {testResult.imageCandidates.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {testResult.imageCandidates.slice(0, 6).map((m) => (
                          <span
                            key={m}
                            className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono-num text-[10px] text-emerald-200"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Model Selection */}
          <div className="space-y-3 rounded-xl border border-[#282E39] bg-[#111419] p-3.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
              <Cpu className="h-3.5 w-3.5 text-sky-400" />
              模型引擎選擇（可自行挑選或測試探索自動匹配）
            </div>

            <div>
              <label
                htmlFor="gemini-vision-model"
                className="mb-1 block text-[11px] font-medium text-slate-300"
              >
                1. 空間辨識、動線規劃與 JSON 約束模型（Vision / Reasoning）
              </label>
              <select
                id="gemini-vision-model"
                value={visionModel}
                onChange={(e) => setVisionModel(e.target.value)}
                className="w-full rounded-lg border border-[#2D3442] bg-[#0B0D10] px-3 py-2 font-mono-num text-xs text-slate-100 focus:border-[#C89F72] focus:outline-none"
              >
                {visionChoices.map((id) => {
                  const preset = GEMINI_VISION_MODELS.find((m) => m.id === id);
                  return (
                    <option key={id} value={id}>
                      {preset ? `${preset.label}（${preset.badge}）` : id}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label
                htmlFor="gemini-image-model"
                className="mb-1 block text-[11px] font-medium text-slate-300"
              >
                2. 家具重排、風格轉換與單品實景生圖模型（Native Image Edit）
              </label>
              <select
                id="gemini-image-model"
                value={imageModel}
                onChange={(e) => setImageModel(e.target.value)}
                className="w-full rounded-lg border border-[#2D3442] bg-[#0B0D10] px-3 py-2 font-mono-num text-xs text-slate-100 focus:border-[#C89F72] focus:outline-none"
              >
                {imageChoices.map((id) => {
                  const preset = GEMINI_IMAGE_MODELS.find((m) => m.id === id);
                  return (
                    <option key={id} value={id}>
                      {preset ? `${preset.label}（${preset.badge}）` : id}
                    </option>
                  );
                })}
              </select>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-slate-400">
                ※ 預設採用 <code className="text-amber-300">gemini-nano-banana-2.1</code>（2026 GA 主力圖像編輯模型）；若帳號僅開放免費文字配額而遇生圖 429／權限錯誤，請於 Google AI Studio 為該專案連結計費帳戶以解鎖 Nano Banana 生圖配額。
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[#252B35] bg-[#13161B] px-4 sm:px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#2D3442] bg-[#191D24] px-4 py-2 text-xs font-medium text-slate-300 hover:bg-[#222730] cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="flex items-center gap-1.5 rounded-lg bg-[#C89F72] px-5 py-2 text-xs font-bold text-[#111315] hover:bg-[#D8B084] disabled:opacity-50 transition cursor-pointer"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            儲存設定並套用
          </button>
        </div>
      </div>
    </div>
  );
};
