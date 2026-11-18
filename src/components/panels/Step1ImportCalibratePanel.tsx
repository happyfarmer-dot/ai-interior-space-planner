import React, { useRef } from 'react';
import {
  ArrowRight,
  Brush,
  CheckCircle2,
  Grid,
  Lock,
  Pentagon,
  Ruler,
  Sparkles,
  Trash2,
  Unlock,
  Upload,
} from 'lucide-react';
import { SAMPLE_SCENES } from '../../data/sampleScenes';
import { useDesignStore } from '../../store/useDesignStore';
import type { ProtectionCategory, ScalePreset } from '../../types/design';

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
  } = useDesignStore();

  const { scene, calibration, protectionZones } = state.present;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="space-y-5">
      {/* 1. Room Photo Import / Sample Switcher */}
      <section className="rounded-xl border border-[#282E39] bg-[#191D24] p-3.5">
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#DFBA8C]">
            1. 匯入室內現況照片
          </h3>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 rounded-md border border-[#C89F72]/40 bg-[#C89F72]/15 px-2.5 py-1 text-xs font-medium text-[#E2BE96] hover:bg-[#C89F72]/25 transition cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5" />
            上傳照片
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUploadCustomRoom(file);
            }}
          />
        </div>

        <div className="grid grid-cols-1 gap-2">
          {SAMPLE_SCENES.map((sample) => {
            const active = scene.id === sample.id;
            return (
              <button
                key={sample.id}
                type="button"
                onClick={() => dispatch({ type: 'LOAD_SCENE', scene: sample })}
                className={`flex items-center gap-2.5 rounded-lg border p-2 text-left transition cursor-pointer ${
                  active
                    ? 'border-[#C89F72] bg-[#C89F72]/10'
                    : 'border-[#2B313C] bg-[#13161B] hover:border-slate-600'
                }`}
              >
                <img
                  src={sample.imageUrl}
                  alt={sample.name}
                  className="h-12 w-20 shrink-0 rounded object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-xs font-semibold text-slate-100">
                      {sample.name}
                    </span>
                    {active && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#C89F72]" />}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">
                    {sample.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Module 5: Spatial Scale Calibration */}
      <section className="rounded-xl border border-[#282E39] bg-[#191D24] p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#DFBA8C]">
            功能 5｜空間尺度校準（Pixel-to-CM）
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
            className="w-24 rounded border border-[#2B313C] bg-[#111419] px-2 py-1 font-mono-num text-xs text-slate-100 focus:border-[#C89F72] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setActiveTool(activeTool === 'ruler' ? 'select' : 'ruler')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
              activeTool === 'ruler'
                ? 'bg-amber-400 text-slate-950 shadow'
                : 'border border-amber-400/40 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20'
            }`}
          >
            <Ruler className="h-3.5 w-3.5" />
            {activeTool === 'ruler' ? '完成拉線校準' : '在畫布拉線校準'}
          </button>
        </div>

        {/* 3D Perspective Grid Controls */}
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

      {/* 3. Module 7: Structural & MEP Protection Mask */}
      <section className="rounded-xl border border-[#282E39] bg-[#191D24] p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#DFBA8C]">
            功能 7｜不可更動結構與機電點位鎖定
          </h3>
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: 'AUTO_DETECT_PROTECTION_ZONES',
                zones: scene.defaultProtectionZones,
              })
            }
            className="flex items-center gap-1 rounded bg-sky-500/15 px-2 py-0.5 text-[11px] font-medium text-sky-300 border border-sky-500/30 hover:bg-sky-500/25 cursor-pointer"
          >
            <Sparkles className="h-3 w-3" />
            VLM 自動辨識
          </button>
        </div>

        {/* Category selector & Mask Tools */}
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
            onClick={() => setActiveTool(activeTool === 'brush_mask' ? 'select' : 'brush_mask')}
            className={`flex items-center justify-center gap-1.5 rounded-md border py-1.5 text-xs font-medium transition cursor-pointer ${
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
            onClick={() =>
              setActiveTool(activeTool === 'polygon_mask' ? 'select' : 'polygon_mask')
            }
            className={`flex items-center justify-center gap-1.5 rounded-md border py-1.5 text-xs font-medium transition cursor-pointer ${
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
              尚未標記保護遮罩，請使用筆刷或多邊形工具標出窗戶、冷氣與配電箱。
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
        完成空間校準，前往步驟二：模式與需求設定
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
};
