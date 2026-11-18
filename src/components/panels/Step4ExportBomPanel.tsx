import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  BookmarkPlus,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Printer,
  ScanSearch,
  ShoppingBag,
} from 'lucide-react';
import { useDesignStore } from '../../store/useDesignStore';
import {
  copyTextToClipboard,
  downloadBomCsv,
  formatBomPlainTextReport,
} from '../../utils/exportUtils';

interface Step4Props {
  onOpenProposalModal: (opts?: { autoPrint?: boolean }) => void;
}

export const Step4ExportBomPanel: React.FC<Step4Props> = ({ onOpenProposalModal }) => {
  const {
    state,
    dispatch,
    bom,
    ergonomics,
    visualSearchResults,
    showVisualSearchOverlay,
    setShowVisualSearchOverlay,
    selectedFurnitureId,
    setSelectedFurnitureId,
    runVisualSearch,
  } = useDesignStore();

  const { scene, customPrompt } = state.present;
  const [copyToast, setCopyToast] = useState<'idle' | 'copied' | 'error'>('idle');
  const [fallbackReportText, setFallbackReportText] = useState<string | null>(null);

  useEffect(() => {
    if (copyToast === 'idle') return;
    const timer = setTimeout(() => setCopyToast('idle'), 3000);
    return () => clearTimeout(timer);
  }, [copyToast]);

  const activeSearchSlot =
    visualSearchResults.find((v) => v.slotId === selectedFurnitureId) ?? visualSearchResults[0];

  const budgetCap = bom.budgetCapTWD;
  const midTotal = Math.round((bom.grandMinTWD + bom.grandMaxTWD) / 2);
  const budgetRatio = budgetCap ? Math.min(100, Math.round((midTotal / budgetCap) * 100)) : 0;

  const handleCopyTextReport = async () => {
    const text = formatBomPlainTextReport({
      bom,
      state: state.present,
      ergonomics,
    });
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setFallbackReportText(null);
      setCopyToast('copied');
    } else {
      setFallbackReportText(text);
      setCopyToast('error');
    }
  };

  return (
    <div className="space-y-4">
      {/* 功能 11｜軟裝單品以圖搜物推薦 */}
      <section className="rounded-xl border border-[#282E39] bg-[#191D24] p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <ShoppingBag className="h-4 w-4 text-sky-400 shrink-0" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#DFBA8C]">
              功能 11｜軟裝單品以圖搜物推薦
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
            className={`flex items-center gap-1 shrink-0 rounded px-2 py-0.5 text-[11px] font-medium border transition cursor-pointer ${
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
        {visualSearchResults.length === 0 ? (
          <p className="rounded border border-dashed border-[#2C3340] p-3 text-center text-[11px] text-slate-400">
            尚未偵測可比對之軟裝單品，請先於「功能 1」匯入空間照片或於「功能 6」置入家具物件。
          </p>
        ) : (
          <>
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
                        <div className="flex flex-wrap items-center gap-1.5">
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
                        {m.product.widthCm}×{m.product.depthCm}×{m.product.heightCm}cm ·{' '}
                        {m.dimDiffNote}
                      </span>
                      <span className="flex items-center gap-1 shrink-0 font-mono-num text-emerald-400">
                        匹配 {m.fitScore}%
                        <ExternalLink className="h-3 w-3 opacity-70" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* 功能 12｜粗估工程與軟裝 BOM 預算表 */}
      <section className="rounded-xl border border-[#282E39] bg-[#191D24] p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#DFBA8C]">
            功能 12｜粗估工程與軟裝 BOM 預算表
          </h3>
          <span className="font-mono-num text-[11px] text-slate-400">{scene.areaPing} 坪</span>
        </div>

        {/* Budget Summary Box */}
        <div className="rounded-lg border border-[#2C3340] bg-[#111419] p-3 space-y-2">
          <div className="flex items-baseline justify-between gap-2">
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
                <span
                  className={bom.overBudget ? 'text-rose-400 font-semibold' : 'text-emerald-400'}
                >
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
        <div className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
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
                  <div className="flex flex-wrap items-center gap-1.5">
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
                  <p className="mt-0.5 font-mono-num text-[10px] text-slate-500">
                    {item.unitPriceNote} · 佔總預算 {item.budgetSharePct}%
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

        <button
          type="button"
          onClick={() =>
            dispatch({
              type: 'SAVE_SNAPSHOT',
              name: `定稿快照 (${new Date().toLocaleTimeString('zh-TW', {
                hour: '2-digit',
                minute: '2-digit',
              })})`,
              summary: `預估 NT$${midTotal.toLocaleString()}`,
            })
          }
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#2E3440] bg-[#13161B] py-2 text-xs font-medium text-slate-200 hover:bg-[#1E232B] transition cursor-pointer"
        >
          <BookmarkPlus className="h-3.5 w-3.5 text-[#C89F72]" />
          儲存為設計版本快照（Version Snapshot）
        </button>
      </section>

      {/* 功能 13｜預算分析表一鍵輸出 */}
      <section className="rounded-xl border border-[#C89F72]/45 bg-[#191D24] p-3.5 space-y-3 shadow-[0_0_20px_rgba(200,159,114,0.06)]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Download className="h-4 w-4 text-[#DFBA8C] shrink-0" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#DFBA8C]">
              功能 13｜預算分析表一鍵輸出
            </h3>
          </div>
          <span className="rounded-full bg-[#C89F72]/15 px-2 py-0.5 text-[10px] font-medium text-[#E2BE96]">
            行動裝置適用
          </span>
        </div>

        <p className="text-[11px] leading-relaxed text-slate-400">
          提供 Excel / CSV 明細報表、完整 A4 企劃書列印 PDF 與純文字版本，方便快速傳送至 LINE 與家人或設計師討論。
        </p>

        <div className="space-y-2">
          {/* 1. Download Excel / CSV (UTF-8 BOM) */}
          <button
            type="button"
            onClick={() => downloadBomCsv(bom, scene.name)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/45 bg-emerald-500/12 py-2.5 px-3 text-xs font-bold text-emerald-200 hover:bg-emerald-500/20 transition cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-400 shrink-0" />
            一鍵下載 Excel / CSV 報表（含小計與預算佔比）
          </button>

          {/* 2. Export Full A4 Print / PDF Design & Budget Proposal */}
          <button
            type="button"
            onClick={() => onOpenProposalModal({ autoPrint: true })}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#C89F72] py-2.5 px-3 text-xs font-bold text-[#111315] shadow hover:bg-[#D8B084] transition cursor-pointer"
          >
            <Printer className="h-4 w-4 shrink-0" />
            一鍵匯出完整設計與預算企劃書（列印 / PDF）
          </button>

          {/* 3. Copy Plain Text Budget Breakdown */}
          <button
            type="button"
            onClick={handleCopyTextReport}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-sky-500/45 bg-sky-500/12 py-2.5 px-3 text-xs font-bold text-sky-200 hover:bg-sky-500/20 transition cursor-pointer"
          >
            {copyToast === 'copied' ? (
              <>
                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                已複製到剪貼簿
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 text-sky-400 shrink-0" />
                一鍵複製文字版預算明細（可直接貼至 LINE）
              </>
            )}
          </button>
        </div>

        {/* Clipboard Toast Banner */}
        {copyToast === 'copied' && (
          <div
            role="status"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-300"
          >
            <Check className="h-3.5 w-3.5 shrink-0" />
            已複製到剪貼簿，可直接於 LINE 與家人或設計師貼上討論！
          </div>
        )}
        {(copyToast === 'error' || fallbackReportText) && (
          <div className="space-y-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-200">
            <p role="alert" className="text-[11px] font-medium">
              偵測到目前瀏覽器限制自動寫入剪貼簿，請點擊下方文字框全選複製後貼至 LINE：
            </p>
            {fallbackReportText && (
              <textarea
                readOnly
                rows={5}
                value={fallbackReportText}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full rounded border border-[#2B313C] bg-[#0F1216] p-2 font-mono-num text-[10.5px] leading-relaxed text-slate-200 focus:border-[#C89F72] focus:outline-none"
              />
            )}
          </div>
        )}
      </section>
    </div>
  );
};
