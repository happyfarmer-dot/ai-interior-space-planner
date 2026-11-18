import React from 'react';
import {
  AlertCircle,
  BookmarkPlus,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  ScanSearch,
  ShoppingBag,
} from 'lucide-react';
import { useDesignStore } from '../../store/useDesignStore';
import { downloadBomCsv } from '../../utils/exportUtils';

interface Step4Props {
  onOpenProposalModal: () => void;
}

export const Step4ExportBomPanel: React.FC<Step4Props> = ({ onOpenProposalModal }) => {
  const {
    state,
    dispatch,
    bom,
    visualSearchResults,
    showVisualSearchOverlay,
    setShowVisualSearchOverlay,
    selectedFurnitureId,
    setSelectedFurnitureId,
    runVisualSearch,
  } = useDesignStore();

  const { scene, customPrompt } = state.present;

  const activeSearchSlot =
    visualSearchResults.find((v) => v.slotId === selectedFurnitureId) ?? visualSearchResults[0];

  const budgetCap = bom.budgetCapTWD;
  const midTotal = Math.round((bom.grandMinTWD + bom.grandMaxTWD) / 2);
  const budgetRatio = budgetCap ? Math.min(100, Math.round((midTotal / budgetCap) * 100)) : 0;

  return (
    <div className="space-y-4">
      {/* Module 10: Visual Search & Product Matching */}
      <section className="rounded-xl border border-[#282E39] bg-[#191D24] p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ShoppingBag className="h-4 w-4 text-sky-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#DFBA8C]">
              功能 10｜軟裝單品以圖搜物推薦
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!showVisualSearchOverlay) {
                runVisualSearch();
                dispatch({ type: 'SET_VIEW_MODE', viewMode: 'perspective' });
              } else {
                setShowVisualSearchOverlay(false);
              }
            }}
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium border transition cursor-pointer ${
              showVisualSearchOverlay
                ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                : 'border-[#2B313C] bg-[#13161B] text-slate-300 hover:border-sky-400/50'
            }`}
          >
            <ScanSearch className="h-3 w-3" />
            {showVisualSearchOverlay ? '隱藏框選' : '畫布框選'}
          </button>
        </div>

        {/* Detected Item Slot Tabs */}
        <div className="flex flex-wrap gap-1.5">
          {visualSearchResults.map((vs) => {
            const active = activeSearchSlot?.slotId === vs.slotId;
            return (
              <button
                key={vs.slotId}
                type="button"
                onClick={() => setSelectedFurnitureId(vs.slotId)}
                className={`rounded-md border px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
                  active
                    ? 'border-sky-400 bg-sky-500/15 text-sky-200'
                    : 'border-[#2B313C] bg-[#13161B] text-slate-400 hover:text-slate-200'
                }`}
              >
                {vs.slotLabel}
              </button>
            );
          })}
        </div>

        {activeSearchSlot && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>
                空間推估尺吋：{activeSearchSlot.estimatedDimsCm.w} ×{' '}
                {activeSearchSlot.estimatedDimsCm.d} × {activeSearchSlot.estimatedDimsCm.h} cm
              </span>
              {customPrompt.parsedJson.petFriendly && (
                <span className="text-emerald-400">優先篩選耐抓耐磨</span>
              )}
            </div>

            {activeSearchSlot.matches.map((m) => (
              <div
                key={m.product.id}
                className="rounded-lg border border-[#272D38] bg-[#13161B] p-2.5 space-y-1"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-slate-100">
                        {m.product.brand}
                      </span>
                      <span className="text-xs font-semibold text-slate-100">
                        {m.product.name}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10.5px] text-slate-400">{m.product.material}</p>
                  </div>
                  <span className="shrink-0 font-mono-num text-xs font-bold text-[#E2BE96]">
                    NT$ {m.product.priceTWD.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 text-[10.5px]">
                  <span className="text-sky-300">
                    {m.product.widthCm}×{m.product.depthCm}×{m.product.heightCm}cm · {m.dimDiffNote}
                  </span>
                  <span className="flex items-center gap-1 font-mono-num text-emerald-400">
                    匹配 {m.fitScore}%
                    <ExternalLink className="h-3 w-3 opacity-70" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Module 11: BOM & Rough Budget Estimator */}
      <section className="rounded-xl border border-[#282E39] bg-[#191D24] p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#DFBA8C]">
            功能 11｜粗估工程與軟裝 BOM 預算表
          </h3>
          <span className="font-mono-num text-[11px] text-slate-400">{scene.areaPing} 坪</span>
        </div>

        {/* Budget Summary Box */}
        <div className="rounded-lg border border-[#2C3340] bg-[#111419] p-3 space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-slate-400">預估總費用區間（台灣行情）</span>
            <span className="font-mono-num text-sm font-bold text-[#E2BE96]">
              NT$ {bom.grandMinTWD.toLocaleString()} ～ {bom.grandMaxTWD.toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded bg-[#181C22] px-2 py-1.5">
              <span className="text-slate-400">工程表面材</span>
              <p className="font-mono-num font-semibold text-slate-200">
                NT$ {bom.surfaceMinTWD.toLocaleString()}–{bom.surfaceMaxTWD.toLocaleString()}
              </p>
            </div>
            <div className="rounded bg-[#181C22] px-2 py-1.5">
              <span className="text-slate-400">軟裝單品採購</span>
              <p className="font-mono-num font-semibold text-slate-200">
                NT$ {bom.softMinTWD.toLocaleString()}–{bom.softMaxTWD.toLocaleString()}
              </p>
            </div>
          </div>

          {budgetCap && (
            <div className="pt-1">
              <div className="mb-1 flex justify-between text-[10.5px]">
                <span className={bom.overBudget ? 'text-rose-400 font-semibold' : 'text-emerald-400'}>
                  {bom.overBudget
                    ? `⚠ 超出設定預算上限 (NT$ ${budgetCap.toLocaleString()})`
                    : `✓ 符合預算上限 (NT$ ${budgetCap.toLocaleString()})`}
                </span>
                <span className="font-mono-num text-slate-400">{budgetRatio}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#242A34]">
                <div
                  className={`h-full transition-all ${
                    bom.overBudget ? 'bg-rose-500' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${budgetRatio}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* BOM Line Items */}
        <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
          {bom.items.length === 0 ? (
            <p className="rounded border border-dashed border-[#2C3340] p-3 text-center text-[11px] text-slate-400">
              尚未產生表面材或軟裝變動項目（請於步驟二／三套用風格、材質或新增家具）。
            </p>
          ) : (
            bom.items.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-[#262C37] bg-[#13161B] px-2.5 py-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9.5px] font-semibold ${
                        item.category === '工程表面材'
                          ? 'bg-amber-500/15 text-amber-300'
                          : 'bg-sky-500/15 text-sky-300'
                      }`}
                    >
                      {item.category}
                    </span>
                    <span className="truncate font-semibold text-slate-100">{item.name}</span>
                  </div>
                  <p className="mt-0.5 text-[10.5px] text-slate-400">
                    {item.quantityLabel} · {item.spec}
                  </p>
                </div>
                <div className="shrink-0 text-right font-mono-num text-[11px] text-slate-200">
                  {item.minTotalTWD.toLocaleString()}–{item.maxTotalTWD.toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Mandatory Disclaimer */}
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 p-2.5 text-[11px] text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <span className="font-medium leading-relaxed">{bom.disclaimer}</span>
        </div>
      </section>

      {/* Export Actions */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={onOpenProposalModal}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#C89F72] py-2.5 text-xs font-bold text-[#111315] shadow hover:bg-[#D8B084] transition cursor-pointer"
        >
          <FileText className="h-4 w-4" />
          一鍵生成並匯出 PDF 設計企劃書
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => downloadBomCsv(bom, scene.name)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-[#2E3440] bg-[#191D24] py-2 text-xs font-medium text-slate-200 hover:bg-[#232832] transition cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
            匯出 CSV 估價表
          </button>
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: 'SAVE_SNAPSHOT',
                name: `定稿快照 (${new Date().toLocaleTimeString('zh-TW', {
                  hour: '2-digit',
                  minute: '2-digit',
                })})`,
                summary: `預估 NT$${Math.round((bom.grandMinTWD + bom.grandMaxTWD) / 2).toLocaleString()}`,
              })
            }
            className="flex items-center justify-center gap-1.5 rounded-lg border border-[#2E3440] bg-[#191D24] py-2 text-xs font-medium text-slate-200 hover:bg-[#232832] transition cursor-pointer"
          >
            <BookmarkPlus className="h-3.5 w-3.5 text-[#C89F72]" />
            保存版本快照
          </button>
        </div>
        <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500">
          <Download className="h-3 w-3" />
          <span>企劃書包含 Before/After 對比、2D 平面配置、工學報告與 BOM 明細</span>
        </div>
      </div>
    </div>
  );
};
