import React, { useRef, useState } from 'react';
import {
  ArrowRight,
  Brush,
  Camera,
  CheckCircle2,
  Grid,
  ImagePlus,
  KeyRound,
  Lock,
  Pentagon,
  Ruler,
  Sparkles,
  Trash2,
  Unlock,
  Upload,
} from 'lucide-react';
import { useDesignStore } from '../../store/useDesignStore';
import type { ProtectionCategory, ScalePreset } from '../../types/design';
import { isNativeApp } from '../../utils/nativePlatform';

const SCALE_PRESETS: Array<{ id: ScalePreset; label: string; cm: number }> = [
  { id: 'door_210', label: '標準房門高 210cm', cm: 210 },
  { id: 'outlet_12', label: '插座面板高 12cm', cm: 12 },
  { id: 'a4_29_7', label: 'A4 紙長 29.7cm', cm: 29.7 },
  { id: 'tile_60', label: '地磚邊長 60cm', cm: 60 },
  { id: 'custom', label: '自訂公分數', cm: 100 },
];

const MEP_CATEGORIES: Array<{ id: ProtectionCategory; label: string; colorClass: string }> = [
  { id: 'window', label: '對外採光窗', colorClass: 'bg-sky-400' },
  { id: 'ac_unit', label: '冷氣與出風口', colorClass: 'bg-teal-400' },
  { id: 'electrical_panel', label: '總配電箱', colorClass: 'bg-rose-500' },
  { id: 'beam_column', label: '結構樑柱', colorClass: 'bg-amber-400' },
  { id: 'power_outlet', label: '重要插座', colorClass: 'bg-orange-400' },
];

export const Step1ImportCalibratePanel: React.FC = () => {
  const {
    state,
    dispatch,
    activeTool,
    setActiveTool,
    activeBrushCategory,
    setActiveBrushCategory,
    brushSizePx,
    setBrushSizePx,
    handleUploadCustomRoom,
    pickRoomPhotoNative,
    runDetectSceneVLM,
    geminiConfig,
    setShowGeminiSettings,
    isAiBusy,
  } = useDesignStore();

  const { scene, calibration, protectionZones, furniture } = state.present;
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const hasPhoto = Boolean(scene.imageUrl);
  const geminiReady = Boolean(geminiConfig.apiKey.trim());
  const busy = Boolean(isAiBusy);

  const handleFilePicked = (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    handleUploadCustomRoom(file);
  };

  return (
    <div className="space-y-4">
      {/* Gemini AI 引擎連線狀態卡片 */}
      <section
        className={`rounded-xl border p-3 ${
          geminiReady
            ? 'border-emerald-500/35 bg-emerald-500/10'
            : 'border-amber-400/50 bg-amber-500/10'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-bold text-slate-100">
              {geminiReady ? (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>Gemini 真實 AI 引擎已就緒</span>
                </>
              ) : (
                <>
                  <KeyRound className="h-3.5 w-3.5 text-amber-300 shrink-0" />
                  <span>尚未設定 Google Gemini API Key</span>
                </>
              )}
            </p>
            <p className="mt-0.5 truncate text-[10.5px] text-slate-300">
              {geminiReady
                ? `生圖模型：${geminiConfig.imageModel} · 視覺：${geminiConfig.visionModel}`
                : '填入金鑰即可啟用自動家具辨識、真實空間重排、風格重繪與單品合成'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowGeminiSettings(true)}
            className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition cursor-pointer ${
              geminiReady
                ? 'border border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
                : 'bg-[#C89F72] text-[#111315] hover:bg-[#D8B084]'
            }`}
          >
            {geminiReady ? '變更設定' : '立即設定 Key'}
          </button>
        </div>
      </section>

      {/* 功能 1｜匯入室內現況照片 */}
      <section className="rounded-xl border border-[#282E39] bg-[#191D24] p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#DFBA8C]">
            功能 1｜匯入室內現況照片
          </h3>
          {hasPhoto && (
            <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
              <CheckCircle2 className="h-3 w-3" />
              已匯入照片
            </span>
          )}
        </div>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handleFilePicked(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleFilePicked(e.target.files?.[0]);
            e.target.value = '';
          }}
        />

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFilePicked(e.dataTransfer.files?.[0]);
          }}
          className={`rounded-xl border-2 border-dashed p-3.5 text-center transition ${
            isDragging
              ? 'border-[#C89F72] bg-[#C89F72]/15'
              : 'border-[#2E3542] bg-[#13161B] hover:border-[#414B5C]'
          }`}
        >
          <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg border border-[#2C3340] bg-[#1B2028] text-[#DFBA8C]">
            <ImagePlus className="h-4.5 w-4.5" />
          </div>
          <p className="text-xs font-medium text-slate-200">
            拍攝室內照片或選擇相簿／檔案上傳
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            OffscreenCanvas 自動壓縮至長邊 1280px–1536px（JPEG 0.85 · ≦300KB），防止手機 OOM 並節省 Token
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (isNativeApp()) pickRoomPhotoNative('camera');
                else cameraInputRef.current?.click();
              }}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-[#C89F72] py-2 text-xs font-bold text-[#111315] hover:bg-[#D8B084] disabled:opacity-40 transition cursor-pointer"
            >
              <Camera className="h-3.5 w-3.5" />
              拍攝照片
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (isNativeApp()) pickRoomPhotoNative('photos');
                else fileInputRef.current?.click();
              }}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-[#C89F72]/50 bg-[#1B2028] py-2 text-xs font-semibold text-[#E2BE96] hover:bg-[#242A35] disabled:opacity-40 transition cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5" />
              上傳圖片
            </button>
          </div>
        </div>

        {/* Uploaded Image Metadata & VLM Re-Scan */}
        {hasPhoto && (
          <div className="space-y-2 rounded-lg border border-[#272D38] bg-[#13161B] p-2.5">
            <div className="flex items-center gap-2.5">
              <img
                src={scene.imageUrl}
                alt={scene.name}
                className="h-12 w-20 shrink-0 rounded object-cover border border-white/10"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-100">{scene.name}</p>
                <p className="mt-0.5 font-mono-num text-[10.5px] text-slate-400">
                  {scene.imageWidth} × {scene.imageHeight} px · 已偵測 {furniture.length} 件家具
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={runDetectSceneVLM}
                className="shrink-0 rounded-md border border-sky-500/40 bg-sky-500/15 px-2 py-1 text-[10.5px] font-semibold text-sky-200 hover:bg-sky-500/25 disabled:opacity-40 cursor-pointer"
                title="使用 Gemini Vision 重新掃描照片家具與機電結構"
              >
                AI 分析空間
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
              <div>
                <label className="text-[10px] text-slate-400">空間實測坪數（坪）</label>
                <input
                  type="number"
                  step="0.1"
                  min={1}
                  max={60}
                  value={scene.areaPing}
                  onChange={(e) =>
                    dispatch({
                      type: 'UPDATE_SCENE_INFO',
                      patch: { areaPing: Math.max(1, Number(e.target.value) || 5) },
                    })
                  }
                  className="mt-0.5 w-full rounded border border-[#2B313C] bg-[#0F1216] px-2 py-1 font-mono-num text-xs text-slate-100 focus:border-[#C89F72] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400">樓高參考 (cm)</label>
                <input
                  type="number"
                  min={200}
                  max={450}
                  value={scene.roomDimensionsCm.height}
                  onChange={(e) =>
                    dispatch({
                      type: 'UPDATE_SCENE_INFO',
                      patch: { heightCm: Math.max(200, Number(e.target.value) || 280) },
                    })
                  }
                  className="mt-0.5 w-full rounded border border-[#2B313C] bg-[#0F1216] px-2 py-1 font-mono-num text-xs text-slate-100 focus:border-[#C89F72] focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 功能 2｜空間尺度校準（Pixel-to-CM） */}
      <section className="rounded-xl border border-[#282E39] bg-[#191D24] p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#DFBA8C]">
            功能 2｜空間尺度校準（Pixel-to-CM）
          </h3>
          <span
            className={`rounded-full px-2 py-0.5 font-mono-num text-[10px] font-semibold ${
              calibration.calibrated
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
            }`}
          >
            {calibration.calibrated ? `${calibration.pixelPerCm} px/cm` : '待拉線校準'}
          </span>
        </div>

        <p className="mb-2.5 text-[11px] text-slate-400">
          選擇畫面中已知物理尺寸的參照物，並使用比例尺工具在畫布上拉出對應線段以建立真實比例與 3D 透視網格。
        </p>

        <div className="mb-2.5 grid grid-cols-2 gap-1.5">
          {SCALE_PRESETS.map((p) => {
            const active = calibration.preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  dispatch({
                    type: 'UPDATE_CALIBRATION',
                    patch: {
                      preset: p.id,
                      referenceCm: p.id === 'custom' ? calibration.referenceCm : p.cm,
                    },
                  })
                }
                className={`rounded-md border px-2 py-1.5 text-left text-[11px] transition cursor-pointer ${
                  active
                    ? 'border-amber-400/70 bg-amber-400/10 text-amber-200 font-medium'
                    : 'border-[#2B313C] bg-[#13161B] text-slate-300 hover:bg-[#1E232B]'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="mb-3 flex items-center gap-2">
          <label className="text-xs text-slate-400 shrink-0">參照實長 (cm)：</label>
          <input
            type="number"
            min={5}
            max={600}
            value={calibration.referenceCm}
            onChange={(e) =>
              dispatch({
                type: 'UPDATE_CALIBRATION',
                patch: {
                  preset: 'custom',
                  referenceCm: Math.max(5, Number(e.target.value) || 100),
                },
              })
            }
            className="w-20 sm:w-24 rounded border border-[#2B313C] bg-[#111419] px-2 py-1 font-mono-num text-xs text-slate-100 focus:border-[#C89F72] focus:outline-none"
          />
          <button
            type="button"
            disabled={!hasPhoto}
            onClick={() => setActiveTool(activeTool === 'ruler' ? 'select' : 'ruler')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
              activeTool === 'ruler'
                ? 'bg-amber-400 text-slate-950 shadow'
                : 'border border-amber-400/40 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20'
            }`}
          >
            <Ruler className="h-3.5 w-3.5" />
            {activeTool === 'ruler' ? '完成拉線校準' : '在畫布拉線校準'}
          </button>
        </div>

        <div className="rounded-lg border border-[#252B35] bg-[#13161B] p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs text-slate-300">
              <Grid className="h-3.5 w-3.5 text-sky-400" />
              顯示 3D 空間透視輔助網格
            </span>
            <input
              type="checkbox"
              checked={calibration.showPerspectiveGrid}
              onChange={(e) =>
                dispatch({
                  type: 'UPDATE_CALIBRATION',
                  patch: { showPerspectiveGrid: e.target.checked },
                  recordHistory: false,
                })
              }
              className="h-4 w-4 accent-[#C89F72] cursor-pointer"
            />
          </div>
          {calibration.showPerspectiveGrid && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>地平線高度</span>
                  <span className="font-mono-num">{Math.round(calibration.horizonY * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={25}
                  max={65}
                  value={Math.round(calibration.horizonY * 100)}
                  onChange={(e) =>
                    dispatch({
                      type: 'UPDATE_CALIBRATION',
                      patch: { horizonY: Number(e.target.value) / 100 },
                      recordHistory: false,
                    })
                  }
                  className="cad-slider w-full"
                />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>消失點水平</span>
                  <span className="font-mono-num">{Math.round(calibration.vanishingX * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={80}
                  value={Math.round(calibration.vanishingX * 100)}
                  onChange={(e) =>
                    dispatch({
                      type: 'UPDATE_CALIBRATION',
                      patch: { vanishingX: Number(e.target.value) / 100 },
                      recordHistory: false,
                    })
                  }
                  className="cad-slider w-full"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 功能 3｜不可更動結構與機電點位鎖定 */}
      <section className="rounded-xl border border-[#282E39] bg-[#191D24] p-3.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#DFBA8C]">
            功能 3｜不可更動結構與機電點位鎖定
          </h3>
          <button
            type="button"
            disabled={!hasPhoto || busy}
            onClick={runDetectSceneVLM}
            className="flex items-center gap-1 shrink-0 rounded bg-sky-500/15 px-2 py-0.5 text-[11px] font-medium text-sky-300 border border-sky-500/30 hover:bg-sky-500/25 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Sparkles className="h-3 w-3" />
            Gemini VLM 自動辨識
          </button>
        </div>

        <div className="mb-2 flex flex-wrap gap-1">
          {MEP_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveBrushCategory(cat.id)}
              className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition cursor-pointer ${
                activeBrushCategory === cat.id
                  ? 'border-white/50 bg-white/10 text-white font-medium'
                  : 'border-[#2B313C] bg-[#13161B] text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${cat.colorClass}`} />
              {cat.label}
            </button>
          ))}
        </div>

        <div className="mb-2.5 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!hasPhoto}
            onClick={() => setActiveTool(activeTool === 'brush_mask' ? 'select' : 'brush_mask')}
            className={`flex items-center justify-center gap-1.5 rounded-md border py-1.5 text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
              activeTool === 'brush_mask'
                ? 'border-rose-400 bg-rose-500/20 text-rose-200'
                : 'border-[#2B313C] bg-[#13161B] text-slate-300 hover:bg-[#1E232B]'
            }`}
          >
            <Brush className="h-3.5 w-3.5" />
            {activeTool === 'brush_mask' ? '停用筆刷' : '筆刷塗抹遮罩'}
          </button>
          <button
            type="button"
            disabled={!hasPhoto}
            onClick={() =>
              setActiveTool(activeTool === 'polygon_mask' ? 'select' : 'polygon_mask')
            }
            className={`flex items-center justify-center gap-1.5 rounded-md border py-1.5 text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
              activeTool === 'polygon_mask'
                ? 'border-rose-400 bg-rose-500/20 text-rose-200'
                : 'border-[#2B313C] bg-[#13161B] text-slate-300 hover:bg-[#1E232B]'
            }`}
          >
            <Pentagon className="h-3.5 w-3.5" />
            {activeTool === 'polygon_mask' ? '停用多邊形' : '多邊形框選'}
          </button>
        </div>

        {activeTool === 'brush_mask' && (
          <div className="mb-2.5 flex items-center gap-2 text-[11px] text-slate-400">
            <span>筆刷粗細</span>
            <input
              type="range"
              min={12}
              max={64}
              value={brushSizePx}
              onChange={(e) => setBrushSizePx(Number(e.target.value))}
              className="cad-slider flex-1"
            />
            <span className="font-mono-num w-8 text-right">{brushSizePx}px</span>
          </div>
        )}

        <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
          {protectionZones.length === 0 && (
            <p className="rounded border border-dashed border-[#2D3440] p-2.5 text-center text-[11px] text-slate-500">
              {hasPhoto
                ? '尚未標記保護遮罩，請點擊「Gemini VLM 自動辨識」或使用筆刷／多邊形工具標出窗戶、冷氣與配電箱。'
                : '請先於「功能 1」匯入空間照片，即可標記或自動辨識機電結構鎖定區域。'}
            </p>
          )}
          {protectionZones.map((zone) => (
            <div
              key={zone.id}
              className="flex items-center justify-between rounded-md border border-[#272D38] bg-[#13161B] px-2.5 py-1.5 text-xs"
            >
              <span className="truncate text-slate-200">{zone.label}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'TOGGLE_ZONE_LOCK', id: zone.id })}
                  className={`rounded p-1 transition cursor-pointer ${
                    zone.locked
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                  title={zone.locked ? '已鎖定保護' : '已暫停鎖定'}
                >
                  {zone.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'REMOVE_PROTECTION_ZONE', id: zone.id })}
                  className="rounded p-1 text-slate-500 hover:bg-rose-500/15 hover:text-rose-400 cursor-pointer"
                  title="移除標記"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={() => {
          setActiveTool('select');
          dispatch({ type: 'SET_STEP', step: 2 });
        }}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#C89F72] py-2.5 text-xs font-bold text-[#111315] shadow hover:bg-[#D8B084] transition cursor-pointer"
      >
        前往步驟二：設計模式與客製需求（功能 4～7）
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
};
