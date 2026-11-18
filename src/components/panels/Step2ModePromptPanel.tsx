import React, { useRef, useState } from 'react';
import {
  ArrowRight,
  Box,
  Cpu,
  KeyRound,
  LayoutTemplate,
  Palette,
  RefreshCw,
  Scissors,
  Sparkles,
  Upload,
} from 'lucide-react';
import { SAMPLE_ADDON_ITEMS } from '../../data/sampleScenes';
import { STYLES_CATALOG } from '../../data/stylesCatalog';
import { useDesignStore } from '../../store/useDesignStore';
import type { DesignMode } from '../../types/design';
import { isNativeApp, pickImageWithNativeCamera } from '../../utils/nativePlatform';

const QUICK_CONSTRAINT_TAGS = [
  '寵物防抓耐磨',
  '貓跳台動線',
  '預算上限 30 萬',
  '玄關落塵區',
  '大量收納櫃',
  '保留原有實木桌',
  '無障礙寬走道',
  '親子安全圓角',
];

export const Step2ModePromptPanel: React.FC = () => {
  const {
    state,
    dispatch,
    geminiConfig,
    setShowGeminiSettings,
    runDetectSceneVLM,
    runParseConstraints,
    runGenerateProposals,
    runApplyStyleTransfer,
    runPrepareNewObject,
    runPlaceNewObjectWithAi,
  } = useDesignStore();

  const { scene, activeMode, furniture, styleConfig, newObject, customPrompt } = state.present;
  const [localText, setLocalText] = useState(customPrompt.freeText);
  const [localTags, setLocalTags] = useState<string[]>(customPrompt.selectedTags);
  const itemFileRef = useRef<HTMLInputElement | null>(null);
  const hasPhoto = Boolean(scene.imageUrl);
  const geminiReady = Boolean(geminiConfig.apiKey.trim());

  const toggleTag = (tag: string) => {
    const next = localTags.includes(tag)
      ? localTags.filter((t) => t !== tag)
      : [...localTags, tag];
    setLocalTags(next);
    runParseConstraints(localText, next, { allowLocalFallback: !geminiReady });
  };

  const handleUploadObjectImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      runPrepareNewObject(
        url,
        file.name.replace(/\.[^/.]+$/, '') || '自訂添購單品',
        newObject.widthCm,
        newObject.depthCm,
        newObject.heightCm,
        newObject.bgRemovalThreshold
      );
    };
    reader.readAsDataURL(file);
  };

  const handlePickObjectNativeOrWeb = async () => {
    if (isNativeApp()) {
      try {
        const picked = await pickImageWithNativeCamera('photos');
        if (picked) {
          await runPrepareNewObject(
            picked.dataUrl,
            picked.fileName.replace(/\.[^/.]+$/, '') || '自訂添購單品',
            newObject.widthCm,
            newObject.depthCm,
            newObject.heightCm,
            newObject.bgRemovalThreshold
          );
        }
      } catch {
        // user cancelled or denied permission
      }
      return;
    }
    itemFileRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {!geminiReady && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-400/50 bg-amber-500/10 p-3 text-xs">
          <div className="min-w-0">
            <p className="font-bold text-amber-200">請先連線 Gemini AI API</p>
            <p className="text-[10.5px] text-slate-300">
              家具重排、風格轉換與單品合成皆需使用您設定的 Gemini Key 執行真實 AI 演算。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowGeminiSettings(true)}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-[#C89F72] px-2.5 py-1.5 text-[11px] font-bold text-[#111315] hover:bg-[#D8B084] cursor-pointer"
          >
            <KeyRound className="h-3.5 w-3.5" />
            設定 Key
          </button>
        </div>
      )}

      {/* Mode Selector Tabs */}
      <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-[#282E39] bg-[#14171C] p-1">
        {(
          [
            { id: 'rearrange', label: '傢俱智慧重排', sub: '功能 4', icon: LayoutTemplate },
            { id: 'style', label: '多元風格轉換', sub: '功能 5', icon: Palette },
            { id: 'place_object', label: '新增物件合成', sub: '功能 6', icon: Box },
          ] as Array<{
            id: DesignMode;
            label: string;
            sub: string;
            icon: React.ComponentType<{ className?: string }>;
          }>
        ).map((m) => {
          const Icon = m.icon;
          const active = activeMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => dispatch({ type: 'SET_MODE', mode: m.id })}
              className={`flex flex-col items-center rounded-lg px-1.5 py-2 text-center transition cursor-pointer ${
                active
                  ? 'bg-[#C89F72] text-[#111315] shadow-sm'
                  : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              <Icon className="mb-1 h-4 w-4" />
              <span className="text-[11px] font-bold leading-tight">{m.label}</span>
              <span className={`text-[9.5px] ${active ? 'text-[#2C2014]' : 'text-slate-500'}`}>
                {m.sub}
              </span>
            </button>
          );
        })}
      </div>

      {/* 功能 4｜現有傢俱智慧重排與空間優化 */}
      {activeMode === 'rearrange' && (
        <section className="rounded-xl border border-[#282E39] bg-[#191D24] p-3.5 space-y-3">
          <div>
            <h3 className="text-xs font-semibold text-[#DFBA8C]">
              功能 4｜現有傢俱智慧重排與空間優化
            </h3>
            <p className="mt-1 text-[11px] text-slate-400">
              保留現有主要家具物件，透過 Gemini Vision 演算 2～3 組動線方案，並由 {geminiConfig.imageModel} 生成真實重排後的室內模擬照片與 2D 平面圖。
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-300">
                VLM 已辨識現有家具清單（保留重排對象）：
              </span>
              {hasPhoto && (
                <button
                  type="button"
                  onClick={runDetectSceneVLM}
                  className="flex items-center gap-1 text-[10.5px] text-sky-400 hover:underline cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3" />
                  重新掃描照片家具
                </button>
              )}
            </div>
            {furniture.filter((f) => f.isOriginal).length === 0 ? (
              <p className="rounded border border-dashed border-[#2B313C] p-2.5 text-center text-[11px] text-slate-500">
                {hasPhoto
                  ? '尚未掃描現有家具（點擊下方生成按鈕將自動以 Gemini AI 辨識並完成重排與繪製）'
                  : '請先於「功能 1」匯入現況空間照片'}
              </p>
            ) : (
              furniture
                .filter((f) => f.isOriginal)
                .map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-md border border-[#272D38] bg-[#13161B] px-2.5 py-1.5 text-xs"
                  >
                    <span className="text-slate-200">{item.name}</span>
                    <span className="font-mono-num text-[11px] text-slate-400">
                      {item.widthCm}×{item.depthCm}×{item.heightCm}cm
                    </span>
                  </div>
                ))
            )}
          </div>

          <button
            type="button"
            disabled={!hasPhoto}
            onClick={runGenerateProposals}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#C89F72] py-2.5 text-xs font-bold text-[#111315] hover:bg-[#D8B084] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          >
            <Sparkles className="h-4 w-4" />
            Gemini AI 生成重排方案與真實實景重排圖
          </button>
        </section>
      )}

      {/* 功能 5｜多元風格轉換與模擬圖生成 */}
      {activeMode === 'style' && (
        <section className="rounded-xl border border-[#282E39] bg-[#191D24] p-3.5 space-y-3">
          <div>
            <h3 className="text-xs font-semibold text-[#DFBA8C]">
              功能 5｜多元風格轉換與模擬圖生成
            </h3>
            <p className="mt-1 text-[11px] text-slate-400">
              使用 {geminiConfig.imageModel} 嚴格鎖定原空間格局、門窗、冷氣與透視比例，生成真實裝修風格實景並支援左右滑桿對比。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {STYLES_CATALOG.map((st) => {
              const selected = styleConfig.selectedStyleId === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: 'SET_STYLE_CONFIG',
                      patch: { selectedStyleId: st.id },
                    })
                  }
                  className={`rounded-lg border p-2 text-left transition cursor-pointer ${
                    selected
                      ? 'border-[#C89F72] bg-[#C89F72]/12'
                      : 'border-[#2B313C] bg-[#13161B] hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-100">{st.nameZh}</span>
                    <div className="flex -space-x-1">
                      {st.palette.map((hex) => (
                        <span
                          key={hex}
                          className="h-3 w-3 rounded-full border border-black/40"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-400">{st.nameEn}</p>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-slate-400">
                    {st.tagline}
                  </p>
                </button>
              );
            })}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-slate-300">風格強度（生成後可即時與原圖混合對比）</span>
              <span className="font-mono-num font-semibold text-[#E2BE96]">
                {styleConfig.intensity}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={styleConfig.intensity}
              onChange={(e) =>
                dispatch({
                  type: 'SET_STYLE_CONFIG',
                  patch: { intensity: Number(e.target.value) },
                  recordHistory: false,
                })
              }
              className="cad-slider w-full"
            />
          </div>

          <button
            type="button"
            disabled={!hasPhoto}
            onClick={runApplyStyleTransfer}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#C89F72] py-2.5 text-xs font-bold text-[#111315] hover:bg-[#D8B084] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          >
            <Sparkles className="h-4 w-4" />
            Gemini AI 生成風格轉換實景並開啟對比
          </button>
        </section>
      )}

      {/* 功能 6｜新增物件智慧擺放與合成 */}
      {activeMode === 'place_object' && (
        <section className="rounded-xl border border-[#282E39] bg-[#191D24] p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#DFBA8C]">
              功能 6｜新增物件智慧擺放與合成
            </h3>
            <button
              type="button"
              onClick={handlePickObjectNativeOrWeb}
              className="flex items-center gap-1 rounded border border-[#C89F72]/40 bg-[#C89F72]/10 px-2 py-0.5 text-[11px] text-[#E2BE96] hover:bg-[#C89F72]/20 cursor-pointer"
            >
              <Upload className="h-3 w-3" />
              上傳單品照
            </button>
            <input
              ref={itemFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadObjectImage(file);
                e.target.value = '';
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {SAMPLE_ADDON_ITEMS.map((item) => {
              const active = newObject.sourceUrl === item.imageUrl;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!hasPhoto}
                  onClick={() =>
                    runPrepareNewObject(
                      item.imageUrl,
                      item.name,
                      item.widthCm,
                      item.depthCm,
                      item.heightCm,
                      newObject.bgRemovalThreshold
                    )
                  }
                  className={`flex items-center gap-2 rounded-lg border p-1.5 text-left transition disabled:opacity-40 cursor-pointer ${
                    active
                      ? 'border-[#C89F72] bg-[#C89F72]/12'
                      : 'border-[#2B313C] bg-[#13161B] hover:border-slate-600'
                  }`}
                >
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-11 w-11 rounded bg-white object-contain p-0.5"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-slate-100">
                      {item.name}
                    </p>
                    <p className="font-mono-num text-[10px] text-slate-400">
                      {item.widthCm}×{item.depthCm}×{item.heightCm}cm
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-slate-400">寬 W (cm)</label>
              <input
                type="number"
                value={newObject.widthCm}
                onChange={(e) =>
                  dispatch({
                    type: 'SET_NEW_OBJECT',
                    patch: { widthCm: Math.max(20, Number(e.target.value) || 60) },
                  })
                }
                className="mt-0.5 w-full rounded border border-[#2B313C] bg-[#111419] px-2 py-1 font-mono-num text-xs text-slate-100"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400">深 D (cm)</label>
              <input
                type="number"
                value={newObject.depthCm}
                onChange={(e) =>
                  dispatch({
                    type: 'SET_NEW_OBJECT',
                    patch: { depthCm: Math.max(20, Number(e.target.value) || 60) },
                  })
                }
                className="mt-0.5 w-full rounded border border-[#2B313C] bg-[#111419] px-2 py-1 font-mono-num text-xs text-slate-100"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400">高 H (cm)</label>
              <input
                type="number"
                value={newObject.heightCm}
                onChange={(e) =>
                  dispatch({
                    type: 'SET_NEW_OBJECT',
                    patch: { heightCm: Math.max(20, Number(e.target.value) || 75) },
                  })
                }
                className="mt-0.5 w-full rounded border border-[#2B313C] bg-[#111419] px-2 py-1 font-mono-num text-xs text-slate-100"
              />
            </div>
          </div>

          {newObject.sourceUrl && (
            <div className="flex items-center gap-3 rounded-lg border border-[#272D38] bg-[#13161B] p-2">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-[#2F3644]"
                style={{
                  backgroundImage:
                    'linear-gradient(45deg, #1d222a 25%, transparent 25%), linear-gradient(-45deg, #1d222a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1d222a 75%), linear-gradient(-45deg, transparent 75%, #1d222a 75%)',
                  backgroundSize: '10px 10px',
                  backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px',
                }}
              >
                <img
                  src={newObject.cutoutUrl || newObject.sourceUrl}
                  alt="去背預覽"
                  className="max-h-12 max-w-12 object-contain"
                />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1 text-slate-300">
                    <Scissors className="h-3 w-3 text-emerald-400" />
                    {newObject.bgRemoved ? '已完成自動去背' : '待執行自動去背'}
                  </span>
                  <span className="font-mono-num text-slate-400">
                    容差 {newObject.bgRemovalThreshold}
                  </span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={75}
                  value={newObject.bgRemovalThreshold}
                  onChange={(e) =>
                    dispatch({
                      type: 'SET_NEW_OBJECT',
                      patch: { bgRemovalThreshold: Number(e.target.value) },
                    })
                  }
                  className="cad-slider w-full"
                />
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={!hasPhoto || !newObject.sourceUrl}
            onClick={() => {
              if (newObject.sourceUrl) {
                runPrepareNewObject(
                  newObject.sourceUrl,
                  newObject.itemName,
                  newObject.widthCm,
                  newObject.depthCm,
                  newObject.heightCm,
                  newObject.bgRemovalThreshold
                );
              }
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#C89F72] py-2 text-xs font-bold text-[#111315] hover:bg-[#D8B084] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          >
            <Sparkles className="h-4 w-4" />
            自動去背並由 Gemini 分析建議擺放高亮區
          </button>

          {newObject.suggestedZones.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-medium text-emerald-300">
                點擊任一推薦區，即刻呼叫 Gemini AI 依光影透視合成實景：
              </span>
              {newObject.suggestedZones.map((zone) => {
                const selected = newObject.selectedZoneId === zone.id && newObject.placed;
                return (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => runPlaceNewObjectWithAi(zone.id)}
                    className={`w-full rounded-lg border p-2 text-left transition cursor-pointer ${
                      selected
                        ? 'border-emerald-400 bg-emerald-500/15'
                        : 'border-[#2B313C] bg-[#13161B] hover:border-[#C89F72]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-100">{zone.label}</span>
                      <span className="font-mono-num text-emerald-400">{zone.fitScore} 分</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-400">{zone.reason}</p>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* 功能 7｜客製化裝潢需求設定 */}
      <section className="rounded-xl border border-[#282E39] bg-[#191D24] p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#DFBA8C]">
            功能 7｜客製化裝潢需求設定
          </h3>
          <Cpu className="h-3.5 w-3.5 text-sky-400" />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {QUICK_CONSTRAINT_TAGS.map((tag) => {
            const active = localTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`rounded-full border px-2 py-0.5 text-[11px] transition cursor-pointer ${
                  active
                    ? 'border-[#C89F72] bg-[#C89F72]/20 text-[#F4E6D4] font-medium'
                    : 'border-[#2B313C] bg-[#13161B] text-slate-400 hover:text-slate-200'
                }`}
              >
                + {tag}
              </button>
            );
          })}
        </div>

        <textarea
          rows={3}
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          placeholder="例如：家中有兩隻貓需防抓耐磨材質與貓跳台動線、預算上限 30 萬台幣、增加玄關落塵區與大量收納櫃..."
          className="w-full rounded-lg border border-[#2B313C] bg-[#111419] p-2.5 text-xs leading-relaxed text-slate-100 placeholder:text-slate-600 focus:border-[#C89F72] focus:outline-none"
        />

        <button
          type="button"
          onClick={() => runParseConstraints(localText, localTags)}
          className="w-full rounded-md border border-sky-500/40 bg-sky-500/10 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-500/20 transition cursor-pointer"
        >
          Gemini AI 解析為結構化約束條件（JSON）
        </button>

        <div className="rounded-lg border border-[#252B35] bg-[#0F1216] p-2.5">
          <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400">
            <span>注入 Gemini 生圖管線之 JSON Constraints</span>
            <span className="font-mono-num text-emerald-400">ACTIVE</span>
          </div>
          <pre className="max-h-32 overflow-auto font-mono-num text-[10.5px] leading-relaxed text-slate-300">
            {JSON.stringify(customPrompt.parsedJson, null, 2)}
          </pre>
        </div>
      </section>

      <button
        type="button"
        onClick={() => dispatch({ type: 'SET_STEP', step: 3 })}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#C89F72]/60 bg-[#C89F72]/15 py-2.5 text-xs font-semibold text-[#E2BE96] hover:bg-[#C89F72]/25 transition cursor-pointer"
      >
        前往步驟三：物理檢測與光影材質微調（功能 8～10）
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
};
