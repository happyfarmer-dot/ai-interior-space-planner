import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Columns2,
  LampCeiling,
  Layers,
  Paintbrush,
  ShieldCheck,
  Sun,
  Tv,
  XCircle,
} from 'lucide-react';
import { getMaterialsByTarget } from '../../data/materialsCatalog';
import { STYLES_CATALOG } from '../../data/stylesCatalog';
import { useDesignStore } from '../../store/useDesignStore';
import type { KelvinTemp, SunPreset, SurfaceTarget, TrafficLight } from '../../types/design';

const LIGHT_DOT: Record<TrafficLight, string> = {
  green: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.75)]',
  yellow: 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.75)]',
  red: 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]',
};

const LIGHT_BORDER: Record<TrafficLight, string> = {
  green: 'border-emerald-500/35 bg-emerald-500/5',
  yellow: 'border-amber-500/35 bg-amber-500/5',
  red: 'border-rose-500/45 bg-rose-500/10',
};

const SUN_PRESETS: Array<{ id: SunPreset; label: string; sub: string }> = [
  { id: 'east_morning', label: '東向晨光', sub: '07:30 清亮斜射' },
  { id: 'west_afternoon', label: '西曬午後', sub: '16:00 暖陽斜光' },
  { id: 'north_soft', label: '北向柔和光', sub: '13:00 均勻漫射' },
  { id: 'night_mode', label: '夜間模式', sub: '21:00 室內主燈' },
];

const SURFACE_TABS: Array<{ id: SurfaceTarget; label: string }> = [
  { id: 'floor', label: '地板' },
  { id: 'wall', label: '主牆面' },
  { id: 'sofa', label: '沙發布料' },
  { id: 'curtain', label: '窗簾' },
];

export const Step3RefineInspectPanel: React.FC = () => {
  const {
    state,
    dispatch,
    ergonomics,
    setActiveTool,
    runGenerateProposals,
  } = useDesignStore();

  const {
    scene,
    proposals,
    selectedProposalId,
    styleConfig,
    lighting,
    materials,
    activeMode,
    customPrompt,
  } = state.present;

  const hasPhoto = Boolean(scene.imageUrl);
  const activeTarget: SurfaceTarget = materials.activeTarget ?? 'floor';
  const surfaceMaterials = getMaterialsByTarget(activeTarget);

  return (
    <div className="space-y-4">
      {/* Contextual Rearrangement Proposal Switcher (if triggered from 功能 4) */}
      {(proposals.length > 0 || activeMode === 'rearrange') && (
        <section className="rounded-xl border border-[#282E39] bg-[#191D24] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#DFBA8C]">
              配置提案比較（源自功能 4）
            </h3>
            {proposals.length === 0 && (
              <button
                type="button"
                disabled={!hasPhoto}
                onClick={runGenerateProposals}
                className="rounded bg-[#C89F72]/20 px-2 py-0.5 text-[11px] font-medium text-[#E2BE96] disabled:opacity-40 cursor-pointer"
              >
                立即生成方案
              </button>
            )}
          </div>

          <div className="space-y-2">
            {proposals.map((p) => {
              const selected = selectedProposalId === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => dispatch({ type: 'APPLY_PROPOSAL', proposalId: p.id })}
                  className={`rounded-lg border p-2.5 transition cursor-pointer ${
                    selected
                      ? 'border-[#C89F72] bg-[#C89F72]/10'
                      : 'border-[#2B313C] bg-[#13161B] hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-100">{p.title}</span>
                    <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono-num text-[10px] font-bold text-emerald-300">
                      {p.score} 分
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">{p.subtitle}</p>
                  {selected && (
                    <ul className="mt-2 space-y-1 border-t border-white/10 pt-2 text-[11px] text-slate-300">
                      {p.rationale.map((r, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C89F72]" />
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Contextual Style Intensity & Before/After Toggle (源自功能 5) */}
      {styleConfig.applied && (
        <section className="rounded-xl border border-[#282E39] bg-[#191D24] p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#DFBA8C]">
              風格微調（功能 5）：{STYLES_CATALOG.find((s) => s.id === styleConfig.selectedStyleId)?.nameZh}
            </span>
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_VIEW_MODE', viewMode: 'split' })}
              className="flex items-center gap-1 rounded border border-[#C89F72]/40 bg-[#C89F72]/15 px-2 py-0.5 text-[11px] text-[#E2BE96] cursor-pointer"
            >
              <Columns2 className="h-3 w-3" />
              Before/After 對比
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">強度</span>
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
              className="cad-slider flex-1"
            />
            <span className="w-10 text-right font-mono-num text-xs text-[#E2BE96]">
              {styleConfig.intensity}%
            </span>
          </div>
        </section>
      )}

      {/* 功能 8｜動線淨寬與人體工學自動檢測 */}
      <section className="rounded-xl border border-[#282E39] bg-[#191D24] p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#DFBA8C]">
            功能 8｜動線淨寬與人體工學自動檢測
          </h3>
          <span className="rounded bg-[#111419] px-2 py-0.5 font-mono-num text-xs font-bold text-[#E2BE96] border border-[#2C3340]">
            綜合 {ergonomics.overallScore}/100
          </span>
        </div>

        {/* 1. Main Walkway Traffic Light */}
        <div className={`rounded-lg border p-2.5 ${LIGHT_BORDER[ergonomics.walkwayStatus]}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${LIGHT_DOT[ergonomics.walkwayStatus]}`} />
              <span className="text-xs font-semibold text-slate-100">主要走道淨寬檢測</span>
            </div>
            <span className="font-mono-num text-xs font-bold text-slate-100">
              {ergonomics.mainWalkwayCm} cm
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-300">
            {ergonomics.walkwayStatus === 'green'
              ? '綠燈通過：大於人體工學標準 ≥ 75cm，雙向通行順暢。'
              : ergonomics.walkwayStatus === 'yellow'
              ? '黃燈警示：介於 60–74cm，單人側身可通過但建議放寬。'
              : '紅燈警告：低於 60cm！動線過於狹窄，建議切換至 2D 平面圖拖曳家具微調。'}
          </p>
        </div>

        {/* 2. Door & Cabinet Swing */}
        <div
          className={`rounded-lg border p-2.5 ${
            ergonomics.doorSwingClear ? LIGHT_BORDER.green : LIGHT_BORDER.red
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  ergonomics.doorSwingClear ? LIGHT_DOT.green : LIGHT_DOT.red
                }`}
              />
              <span className="text-xs font-semibold text-slate-100">門片與櫃門開啟半徑</span>
            </div>
            {ergonomics.doorSwingClear ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <XCircle className="h-4 w-4 text-rose-400" />
            )}
          </div>
          <p className="mt-1 text-[11px] text-slate-300">
            {ergonomics.doorSwingClear
              ? '房門與衣櫃門開啟弧線 100% 淨空，無碰撞干涉。'
              : ergonomics.doorConflictItem}
          </p>
        </div>

        {/* 3. Viewing Distance */}
        <div className={`rounded-lg border p-2.5 ${LIGHT_BORDER[ergonomics.tvDistanceStatus]}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tv className="h-3.5 w-3.5 text-sky-400" />
              <span className="text-xs font-semibold text-slate-100">視聽距離與建議螢幕</span>
            </div>
            <span className="font-mono-num text-xs font-bold text-sky-300">
              {ergonomics.viewingDistanceCm} cm · {ergonomics.recommendedTvInches}
            </span>
          </div>
        </div>

        {/* 4. MEP Lock Protection Verification */}
        <div
          className={`rounded-lg border p-2.5 ${
            ergonomics.mepProtectionStatus.conflictCount === 0
              ? LIGHT_BORDER.green
              : LIGHT_BORDER.red
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs font-semibold text-slate-100">
                不可更動結構／機電檢查
              </span>
            </div>
            <span className="font-mono-num text-[11px] text-slate-300">
              鎖定 {ergonomics.mepProtectionStatus.lockedCount} 區 ·{' '}
              {ergonomics.mepProtectionStatus.conflictCount} 衝突
            </span>
          </div>
          {ergonomics.mepProtectionStatus.conflicts.length > 0 && (
            <ul className="mt-1.5 space-y-1 text-[11px] text-rose-300">
              {ergonomics.mepProtectionStatus.conflicts.map((c, idx) => (
                <li key={idx} className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 功能 9｜自然採光時段與人工照明色溫模擬 */}
      <section className="rounded-xl border border-[#282E39] bg-[#191D24] p-3.5 space-y-3">
        <div className="flex items-center gap-1.5">
          <Sun className="h-4 w-4 text-amber-300" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#DFBA8C]">
            功能 9｜自然採光時段與人工照明色溫模擬
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {SUN_PRESETS.map((sun) => {
            const active = lighting.sunPreset === sun.id;
            return (
              <button
                key={sun.id}
                type="button"
                onClick={() =>
                  dispatch({
                    type: 'SET_LIGHTING',
                    patch: {
                      sunPreset: sun.id,
                      recessedDownlights: sun.id === 'night_mode' ? true : lighting.recessedDownlights,
                    },
                  })
                }
                className={`rounded-lg border px-2.5 py-1.5 text-left transition cursor-pointer ${
                  active
                    ? 'border-amber-400/70 bg-amber-400/12'
                    : 'border-[#2B313C] bg-[#13161B] hover:border-slate-600'
                }`}
              >
                <div className="text-xs font-semibold text-slate-100">{sun.label}</div>
                <div className="text-[10px] text-slate-400">{sun.sub}</div>
              </button>
            );
          })}
        </div>

        {/* Kelvin Switcher */}
        <div>
          <span className="mb-1.5 block text-[11px] text-slate-400">人工光源色溫切換</span>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { k: 3000, label: '3000K 暖黃光', swatch: '#FDBA74' },
                { k: 4000, label: '4000K 自然光', swatch: '#FEF3C7' },
                { k: 6000, label: '6000K 白光', swatch: '#DBEAFE' },
              ] as Array<{ k: KelvinTemp; label: string; swatch: string }>
            ).map((opt) => {
              const active = lighting.kelvin === opt.k;
              return (
                <button
                  key={opt.k}
                  type="button"
                  onClick={() => dispatch({ type: 'SET_LIGHTING', patch: { kelvin: opt.k } })}
                  className={`flex items-center justify-center gap-1.5 rounded-md border py-1.5 text-[11px] font-medium transition cursor-pointer ${
                    active
                      ? 'border-[#C89F72] bg-[#C89F72]/15 text-slate-100'
                      : 'border-[#2B313C] bg-[#13161B] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: opt.swatch }}
                  />
                  {opt.k}K
                </button>
              );
            })}
          </div>
        </div>

        {/* Recessed Downlights & Cove Lights */}
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center justify-between rounded-lg border border-[#2B313C] bg-[#13161B] px-2.5 py-2 text-xs cursor-pointer">
            <span className="flex items-center gap-1.5 text-slate-200">
              <LampCeiling className="h-3.5 w-3.5 text-amber-300" />
              無主燈嵌燈
            </span>
            <input
              type="checkbox"
              checked={lighting.recessedDownlights}
              onChange={(e) =>
                dispatch({
                  type: 'SET_LIGHTING',
                  patch: { recessedDownlights: e.target.checked },
                })
              }
              className="h-4 w-4 accent-[#C89F72]"
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-[#2B313C] bg-[#13161B] px-2.5 py-2 text-xs cursor-pointer">
            <span className="flex items-center gap-1.5 text-slate-200">
              <Layers className="h-3.5 w-3.5 text-amber-300" />
              間接燈帶
            </span>
            <input
              type="checkbox"
              checked={lighting.indirectCoveLight}
              onChange={(e) =>
                dispatch({
                  type: 'SET_LIGHTING',
                  patch: { indirectCoveLight: e.target.checked },
                })
              }
              className="h-4 w-4 accent-[#C89F72]"
            />
          </label>
        </div>
      </section>

      {/* 功能 10｜局部材質精準替換 */}
      <section className="rounded-xl border border-[#282E39] bg-[#191D24] p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Paintbrush className="h-3.5 w-3.5 text-[#C89F72]" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#DFBA8C]">
              功能 10｜局部材質精準替換
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'SET_VIEW_MODE', viewMode: 'perspective' });
              setActiveTool('material_pick');
            }}
            className="text-[11px] text-sky-400 hover:underline cursor-pointer"
          >
            在畫面點選表面
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1 rounded-lg bg-[#111419] p-1">
          {SURFACE_TABS.map((t) => {
            const active = activeTarget === t.id;
            const hasOverride = Boolean(materials[t.id]);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  dispatch({
                    type: 'SET_MATERIAL_OVERRIDE',
                    patch: { activeTarget: t.id },
                    recordHistory: false,
                  })
                }
                className={`relative rounded-md py-1.5 text-[11px] font-medium transition cursor-pointer ${
                  active ? 'bg-[#C89F72] text-[#111315]' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
                {hasOverride && !active && (
                  <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                )}
              </button>
            );
          })}
        </div>

        <div className="space-y-1.5">
          {surfaceMaterials.map((mat) => {
            const selected = materials[activeTarget] === mat.id;
            const petMismatch = customPrompt.parsedJson.petFriendly && !mat.petFriendly;
            return (
              <button
                key={mat.id}
                type="button"
                onClick={() =>
                  dispatch({
                    type: 'SET_MATERIAL_OVERRIDE',
                    patch: {
                      [activeTarget]: selected ? null : mat.id,
                      activeTarget,
                    },
                  })
                }
                className={`flex w-full items-center gap-2.5 rounded-lg border p-2 text-left transition cursor-pointer ${
                  selected
                    ? 'border-[#C89F72] bg-[#C89F72]/12'
                    : 'border-[#272D38] bg-[#13161B] hover:border-slate-600'
                }`}
              >
                <span
                  className="h-8 w-8 shrink-0 rounded border border-white/20 shadow-inner"
                  style={{ backgroundColor: mat.swatchHex }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-xs font-semibold text-slate-100">
                      {mat.name}
                    </span>
                    {mat.petFriendly ? (
                      <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9.5px] text-emerald-300">
                        防抓耐磨
                      </span>
                    ) : petMismatch ? (
                      <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9.5px] text-amber-300">
                        不耐抓
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-[10.5px] text-slate-400">
                    {mat.spec} · NT${mat.priceMinPerUnit.toLocaleString()}–
                    {mat.priceMaxPerUnit.toLocaleString()}/{mat.unitLabel}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <button
        type="button"
        onClick={() => {
          setActiveTool('select');
          dispatch({ type: 'SET_STEP', step: 4 });
        }}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#C89F72] py-2.5 text-xs font-bold text-[#111315] shadow hover:bg-[#D8B084] transition cursor-pointer"
      >
        前往步驟四：採購清單與預算一鍵輸出（功能 11～13）
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
};
