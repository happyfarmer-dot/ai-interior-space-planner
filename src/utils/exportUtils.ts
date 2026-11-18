import type { BomReport, CoreDesignSnapshotState } from '../types/design';

export function downloadBomCsv(bom: BomReport, sceneName: string): void {
  const headers = ['類別', '項目名稱', '規格說明', '數量', '單價參考', '預估低標(TWD)', '預估高標(TWD)'];
  const rows = bom.items.map((item) => [
    item.category,
    item.name,
    item.spec,
    item.quantityLabel,
    item.unitPriceNote,
    String(item.minTotalTWD),
    String(item.maxTotalTWD),
  ]);

  rows.push([]);
  rows.push(['總計', sceneName, '表面材 + 軟裝合計', '', '', String(bom.grandMinTWD), String(bom.grandMaxTWD)]);
  rows.push(['備註', bom.disclaimer, '', '', '', '', '']);

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
  a.download = `空間智繪_BOM預算估算_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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
  a.click();
  URL.revokeObjectURL(url);
}
