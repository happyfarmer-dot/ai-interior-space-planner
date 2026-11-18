import type { BomReport, CoreDesignSnapshotState, ErgonomicsReport } from '../types/design';
import { getStyleById } from '../data/stylesCatalog';

export function downloadBomCsv(bom: BomReport, sceneName: string): void {
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

  const csvContent =
    '\uFEFF' +
    [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
      )
      .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `空間智繪_BOM預算分析報表_${new Date().toISOString().slice(0, 10)}.csv`;
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

export function downloadDesignJson(state: CoreDesignSnapshotState): void {
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
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `spatialmind-project-${state.scene.id}.json`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
