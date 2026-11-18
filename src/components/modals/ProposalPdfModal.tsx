import React, { useEffect, useRef, useState } from 'react';
import { FileJson, FileSpreadsheet, Printer, X } from 'lucide-react';
import { getMaterialById } from '../../data/materialsCatalog';
import { getStyleById } from '../../data/stylesCatalog';
import { useDesignStore } from '../../store/useDesignStore';
import { downloadBomCsv, downloadDesignJson } from '../../utils/exportUtils';
import { renderCompositeRoomCanvas } from '../../utils/imageProcessing';

export const ProposalPdfModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { state, ergonomics, bom, visualSearchResults } = useDesignStore();
  const { scene, calibration, protectionZones, styleConfig, materials, lighting, customPrompt } =
    state.present;
  const [generatedDate] = useState(() => new Date().toLocaleDateString('zh-TW'));

  const afterPreviewRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!afterPreviewRef.current) return;
    renderCompositeRoomCanvas(afterPreviewRef.current, {
      scene,
      styleConfig,
      materials,
      lighting,
      furniture: state.present.furniture,
      calibration,
      showBeforeOriginalOnly: false,
      rearrangeProposalActive:
        state.present.activeMode === 'rearrange' && Boolean(state.present.selectedProposalId),
    });
  }, [
    state.present.activeMode,
    scene,
    styleConfig,
    materials,
    lighting,
    state.present.furniture,
    calibration,
    state.present.selectedProposalId,
  ]);

  const styleDef = getStyleById(styleConfig.selectedStyleId);
  const floorMat = getMaterialById(
    materials.floor ?? (styleConfig.applied ? styleDef.recommendedFloorId : null)
  );
  const wallMat = getMaterialById(
    materials.wall ?? (styleConfig.applied ? styleDef.recommendedWallId : null)
  );
  const sofaMat = getMaterialById(materials.sofa);
  const curtainMat = getMaterialById(
    materials.curtain ?? (styleConfig.applied ? styleDef.recommendedCurtainId : null)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
      <div className="print-only-container flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#2F3643] bg-white text-slate-900 shadow-2xl">
        {/* Non-print Modal Top Actions */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-6 py-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              室內空間設計與預算企劃書預覽（Print-Ready PDF）
            </h2>
            <p className="text-xs text-slate-500">
              可直接點擊右側「列印 / 另存 PDF」輸出完整設計報告
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => downloadBomCsv(bom, scene.name)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              下載 CSV
            </button>
            <button
              type="button"
              onClick={() => downloadDesignJson(state.present)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <FileJson className="h-3.5 w-3.5 text-sky-600" />
              專案 JSON
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              列印 / 另存 PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Content */}
        <div className="flex-1 space-y-6 overflow-y-auto p-8 text-slate-800">
          {/* Document Header */}
          <div className="flex items-end justify-between border-b-2 border-slate-900 pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-700">
                SpatialMind AI Interior Planning Proposal
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">
                {scene.name} — 空間規劃與裝潢預算企劃書
              </h1>
              <p className="mt-1 text-xs text-slate-600">
                空間尺度：{scene.roomDimensionsCm.width} × {scene.roomDimensionsCm.depth} ×{' '}
                {scene.roomDimensionsCm.height} cm（約 {scene.areaPing} 坪）｜ 校準比例尺：
                {calibration.pixelPerCm} px/cm
              </p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p>生成日期：{generatedDate}</p>
              <p>風格定調：{styleConfig.applied ? `${styleDef.nameZh} (${styleDef.nameEn})` : '現況微調'}</p>
            </div>
          </div>

          {/* Before / After Visual Comparison */}
          <div className="print-break-inside-avoid grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 p-2">
              <p className="mb-1.5 text-xs font-bold text-slate-700">原始現況 BEFORE</p>
              <img
                src={scene.imageUrl}
                alt="現況圖"
                className="aspect-video w-full rounded-lg object-cover"
              />
            </div>
            <div className="rounded-xl border border-slate-200 p-2">
              <p className="mb-1.5 text-xs font-bold text-amber-800">
                模擬改造方案 AFTER（{lighting.kelvin}K）
              </p>
              <canvas
                ref={afterPreviewRef}
                className="aspect-video w-full rounded-lg object-cover"
              />
            </div>
          </div>

          {/* Constraints & Ergonomics Verification */}
          <div className="print-break-inside-avoid grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                一、物理動線與人體工學檢測報告
              </h3>
              <ul className="mt-2.5 space-y-1.5 text-xs">
                <li>
                  • 主要走道淨寬：<strong className="font-mono-num">{ergonomics.mainWalkwayCm} cm</strong>（
                  {ergonomics.walkwayStatus === 'green'
                    ? '綠燈通過 ≥ 75cm'
                    : ergonomics.walkwayStatus === 'yellow'
                    ? '黃燈注意'
                    : '紅燈警示 < 60cm'}
                  ）
                </li>
                <li>
                  • 門片開啟半徑：
                  <strong>{ergonomics.doorSwingClear ? '無干涉阻擋' : ergonomics.doorConflictItem}</strong>
                </li>
                <li>
                  • 視聽距離與螢幕：
                  <strong className="font-mono-num">
                    {ergonomics.viewingDistanceCm} cm（建議 {ergonomics.recommendedTvInches}）
                  </strong>
                </li>
                <li>
                  • 機電結構保護鎖定：已鎖定{' '}
                  <strong>{protectionZones.filter((z) => z.locked).length} 處</strong>（衝突數：
                  {ergonomics.mepProtectionStatus.conflictCount}）
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                二、光影環境與局部材質選配規格
              </h3>
              <ul className="mt-2.5 space-y-1.5 text-xs">
                <li>
                  • 採光與色溫設定：<strong>{lighting.kelvin}K</strong>｜
                  {lighting.recessedDownlights ? ' 無主燈嵌燈(開)' : ' 嵌燈(關)'}｜
                  {lighting.indirectCoveLight ? ' 間接燈帶(開)' : ' 燈帶(關)'}
                </li>
                <li>• 地坪材質：{floorMat?.name ?? '維持原地坪'}</li>
                <li>• 牆面塗料：{wallMat?.name ?? '維持原牆面'}</li>
                <li>• 沙發與窗簾：{sofaMat?.name ?? '原沙發'} / {curtainMat?.name ?? '原窗簾'}</li>
                {customPrompt.parsedJson.notes.length > 0 && (
                  <li className="text-amber-800">
                    • 客製約束：{customPrompt.parsedJson.notes[0]}
                  </li>
                )}
              </ul>
            </div>
          </div>

          {/* Curated Soft Furnishing Recommendations */}
          <div className="print-break-inside-avoid">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700">
              三、空間軟裝「以圖搜物」實體商品推薦（尺寸吻合清單）
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {visualSearchResults.map((slot) => {
                const top = slot.matches[0];
                if (!top) return null;
                return (
                  <div
                    key={slot.slotId}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900">
                        [{top.product.brand}] {top.product.name}
                      </span>
                      <p className="text-[11px] text-slate-500">
                        {top.product.widthCm}×{top.product.depthCm}×{top.product.heightCm}cm ·{' '}
                        {top.dimDiffNote}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono-num font-bold text-slate-900">
                      NT$ {top.product.priceTWD.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* BOM Table */}
          <div className="print-break-inside-avoid">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700">
              四、粗估工程表面材與軟裝採購 BOM 預算表
            </h3>
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b-2 border-slate-300 bg-slate-100 text-slate-700">
                  <th className="px-3 py-2">類別</th>
                  <th className="px-3 py-2">項目名稱與規格</th>
                  <th className="px-3 py-2">數量估算</th>
                  <th className="px-3 py-2 text-right">預估金額區間 (TWD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {bom.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 font-medium text-slate-600">{item.category}</td>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-slate-900">{item.name}</div>
                      <div className="text-[11px] text-slate-500">{item.spec}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{item.quantityLabel}</td>
                    <td className="px-3 py-2 text-right font-mono-num font-semibold text-slate-900">
                      NT$ {item.minTotalTWD.toLocaleString()} ～ {item.maxTotalTWD.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-900 bg-slate-50 font-bold">
                  <td colSpan={3} className="px-3 py-2.5 text-slate-900">
                    預估總預算區間合計（表面材＋軟裝）
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono-num text-sm text-amber-800">
                    NT$ {bom.grandMinTWD.toLocaleString()} ～ {bom.grandMaxTWD.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>

            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-900">
              ※ 重要免責聲明：{bom.disclaimer}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
