import { getStyleById } from '../data/stylesCatalog';
import type { BomReport, CoreDesignSnapshotState, ErgonomicsReport } from '../types/design';
import { isNativeApp, saveAndShareNativeFile } from './nativePlatform';

export function buildBomCsvContent(bom: BomReport, sceneName: string): string {
  const headers = [
    '類別',
    '品項名稱',
    '規格說明',
    '預估數量/坪數',
    '單價區間參考',
    '小計低標(TWD)',
    '小計高標(TWD)',
    '小計均價(TWD)',
    '總預算佔比(%)',
  ];

  const rows: string[][] =
    bom.items.length > 0
      ? bom.items.map((item) => {
          const mid = Math.round((item.minTotalTWD + item.maxTotalTWD) / 2);
          return [
            item.category,
            item.name,
            item.spec,
            item.quantityLabel,
            item.unitPriceNote,
            String(item.minTotalTWD),
            String(item.maxTotalTWD),
            String(mid),
            `${item.budgetSharePct}%`,
          ];
        })
      : [['說明', '目前尚未選取表面材改裝或新增軟裝項目', '請於步驟二／三選擇風格、材質或單品', '-', '-', '0', '0', '0', '0%']];

  const grandMid = Math.round((bom.grandMinTWD + bom.grandMaxTWD) / 2);
  rows.push([]);
  rows.push([
    '總計',
    sceneName,
    '工程表面材 + 軟裝採購合計',
    '',
    '',
    String(bom.grandMinTWD),
    String(bom.grandMaxTWD),
    String(grandMid),
    bom.items.length > 0 ? '100%' : '0%',
  ]);
  if (bom.budgetCapTWD) {
    rows.push([
      '預算檢核',
      `設定上限 NT$ ${bom.budgetCapTWD.toLocaleString()}`,
      bom.overBudget ? '已超出預算上限，建議調整品項' : '符合預算上限',
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
  }
  rows.push(['免責聲明', bom.disclaimer, '', '', '', '', '', '', '']);

  return (
    '\uFEFF' +
    [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
      )
      .join('\n')
  );
}

export async function downloadBomCsv(bom: BomReport, sceneName: string): Promise<void> {
  const csvContent = buildBomCsvContent(bom, sceneName);
  const filename = `空間智繪_BOM預算分析報表_${new Date().toISOString().slice(0, 10)}.csv`;

  if (isNativeApp()) {
    try {
      await saveAndShareNativeFile(filename, csvContent, '匯出 Excel / CSV 預算報表');
      return;
    } catch {
      // fall back to web download if Share sheet was cancelled
    }
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function formatBomPlainTextReport(params: {
  bom: BomReport;
  state: CoreDesignSnapshotState;
  ergonomics: ErgonomicsReport;
}): string {
  const { bom, state, ergonomics } = params;
  const { scene, styleConfig, lighting } = state;
  const styleDef = getStyleById(styleConfig.selectedStyleId);
  const lines: string[] = [
    '📐 【空間智繪 SpatialMind AI】裝潢設計與預算明細表',
    `🏠 空間：${scene.name}（約 ${scene.areaPing} 坪｜${scene.roomDimensionsCm.width}×${scene.roomDimensionsCm.depth}×${scene.roomDimensionsCm.height} cm）`,
    `🎨 風格與光影：${styleConfig.applied ? `${styleDef.nameZh} (${styleDef.nameEn})` : '現況微調'} · ${lighting.kelvin}K`,
    `🚦 動線人體工學：主走道 ${ergonomics.mainWalkwayCm}cm（${
      ergonomics.walkwayStatus === 'green'
        ? '綠燈通過'
        : ergonomics.walkwayStatus === 'yellow'
        ? '黃燈注意'
        : '紅燈警告'
    }）｜門片${ergonomics.doorSwingClear ? '無干涉' : '需調整'}｜建議電視 ${ergonomics.recommendedTvInches}`,
    '',
    '💰 預估費用明細：',
  ];

  if (bom.items.length === 0) {
    lines.push('• 尚未選取改造表面材或新增軟裝項目');
  } else {
    const surfaceItems = bom.items.filter((i) => i.category === '工程表面材');
    const softItems = bom.items.filter((i) => i.category === '軟裝採購');

    if (surfaceItems.length > 0) {
      lines.push('【工程表面材】');
      for (const item of surfaceItems) {
        lines.push(
          `• ${item.name}｜${item.quantityLabel}｜NT$ ${item.minTotalTWD.toLocaleString()}–${item.maxTotalTWD.toLocaleString()}（佔比 ${item.budgetSharePct}%）`
        );
      }
      lines.push('');
    }

    if (softItems.length > 0) {
      lines.push('【軟裝單品採購】');
      for (const item of softItems) {
        lines.push(
          `• ${item.name}｜${item.quantityLabel}｜NT$ ${item.minTotalTWD.toLocaleString()}–${item.maxTotalTWD.toLocaleString()}（佔比 ${item.budgetSharePct}%）`
        );
      }
      lines.push('');
    }
  }

  lines.push(
    `📊 預估總預算區間：NT$ ${bom.grandMinTWD.toLocaleString()} ～ NT$ ${bom.grandMaxTWD.toLocaleString()}`
  );
  if (bom.budgetCapTWD) {
    lines.push(
      `🎯 預算上限檢核（NT$ ${bom.budgetCapTWD.toLocaleString()}）：${
        bom.overBudget ? '⚠ 已超出上限' : '✓ 符合預算目標'
      }`
    );
  }
  lines.push('');
  lines.push(`※ 免責聲明：${bom.disclaimer}`);

  return lines.join('\n');
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall back to execCommand below for non-HTTPS contexts or strict mobile webviews
    }
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.readOnly = true;
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '2em';
    textarea.style.height = '2em';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    textarea.style.opacity = '0.01';
    textarea.style.fontSize = '16px';
    document.body.appendChild(textarea);
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export async function downloadDesignJson(state: CoreDesignSnapshotState): Promise<void> {
  const payload = {
    exportedAt: new Date().toISOString(),
    system: 'SpatialMind AI Interior Space Planner',
    scene: state.scene.name,
    calibration: state.calibration,
    protectionZones: state.protectionZones,
    customConstraints: state.customPrompt.parsedJson,
    furniture: state.furniture,
    styleConfig: state.styleConfig,
    lighting: state.lighting,
    materials: state.materials,
  };
  const jsonStr = JSON.stringify(payload, null, 2);
  const filename = `spatialmind-project-${state.scene.id}.json`;

  if (isNativeApp()) {
    try {
      await saveAndShareNativeFile(filename, jsonStr, '匯出設計專案 JSON');
      return;
    } catch {
      // fall through
    }
  }

  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function shareHtmlProposalOnNative(params: {
  state: CoreDesignSnapshotState;
  ergonomics: ErgonomicsReport;
  bom: BomReport;
  afterImageDataUrl?: string | null;
}): Promise<boolean> {
  if (!isNativeApp()) return false;
  const { state, ergonomics, bom, afterImageDataUrl } = params;
  const { scene, calibration, lighting, styleConfig } = state;
  const styleDef = getStyleById(styleConfig.selectedStyleId);

  const html = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${scene.name} — 空間設計與預算企劃書</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Noto Sans TC", sans-serif; color: #1e293b; margin: 24px; line-height: 1.5; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .meta { color: #64748b; font-size: 13px; margin-bottom: 16px; border-bottom: 2px solid #0f172a; padding-bottom: 12px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px; }
  .card { border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px; }
  img { width: 100%; border-radius: 6px; display: block; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
  th, td { border-bottom: 1px solid #e2e8f0; padding: 8px; text-align: left; }
  th { background: #f1f5f9; }
  .disclaimer { margin-top: 16px; padding: 10px; border-radius: 8px; background: #fffbeb; border: 1px solid #fcd34d; color: #92400e; font-size: 12px; }
</style>
</head>
<body>
  <h1>${scene.name} — 空間規劃與裝潢預算企劃書</h1>
  <div class="meta">
    空間尺度：${scene.roomDimensionsCm.width} × ${scene.roomDimensionsCm.depth} × ${scene.roomDimensionsCm.height} cm（約 ${scene.areaPing} 坪）｜比例尺 ${calibration.pixelPerCm} px/cm ｜ 風格：${styleConfig.applied ? styleDef.nameZh : '現況設計'} ｜ ${lighting.kelvin}K
  </div>
  <div class="grid">
    <div class="card"><strong>原始現況 BEFORE</strong>${scene.imageUrl ? `<img src="${scene.imageUrl}" />` : '<p>無照片</p>'}</div>
    <div class="card"><strong>AI 模擬改造 AFTER</strong>${afterImageDataUrl ? `<img src="${afterImageDataUrl}" />` : '<p>尚未渲染</p>'}</div>
  </div>
  <div class="card">
    <strong>物理動線檢測</strong>
    <ul>
      <li>主要走道淨寬：${ergonomics.mainWalkwayCm} cm（綜合評分 ${ergonomics.overallScore}/100）</li>
      <li>門片開啟半徑：${ergonomics.doorSwingClear ? '無干涉阻擋' : ergonomics.doorConflictItem}</li>
      <li>視聽距離建議：${ergonomics.viewingDistanceCm} cm（${ergonomics.recommendedTvInches}）</li>
    </ul>
  </div>
  <table>
    <thead><tr><th>類別</th><th>項目</th><th>數量</th><th>金額區間</th><th>佔比</th></tr></thead>
    <tbody>
      ${bom.items
        .map(
          (i) =>
            `<tr><td>${i.category}</td><td>${i.name}</td><td>${i.quantityLabel}</td><td>NT$ ${i.minTotalTWD.toLocaleString()}–${i.maxTotalTWD.toLocaleString()}</td><td>${i.budgetSharePct}%</td></tr>`
        )
        .join('')}
      <tr><th colspan="3">總計預算區間</th><th colspan="2">NT$ ${bom.grandMinTWD.toLocaleString()} ～ ${bom.grandMaxTWD.toLocaleString()}</th></tr>
    </tbody>
  </table>
  <div class="disclaimer">※ 重要免責聲明：${bom.disclaimer}</div>
</body>
</html>`;

  const filename = `空間智繪_設計企劃書_${new Date().toISOString().slice(0, 10)}.html`;
  await saveAndShareNativeFile(filename, html, '匯出或列印完整企劃書');
  return true;
}
