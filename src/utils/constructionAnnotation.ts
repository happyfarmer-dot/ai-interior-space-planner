import { getMaterialById } from '../data/materialsCatalog';
import { getStyleById } from '../data/stylesCatalog';
import type {
  CoreDesignSnapshotState,
  ErgonomicsReport,
  ProtectionCategory,
} from '../types/design';
import { renderCompositeRoomCanvas } from './imageProcessing';
import { isNativeApp, saveAndShareNativeBase64Png } from './nativePlatform';

const PROTECTION_WARNING_LABELS: Record<ProtectionCategory, string> = {
  electrical_panel: '⚠ 總配電箱／弱電箱（嚴禁遮擋或封死）',
  ac_unit: '⚠ 冷氣室內機／排水管線（嚴禁移位或阻擋迴風）',
  beam_column: '⚠ 結構主樑／承重柱（嚴禁鑽孔洗洞或敲除）',
  window: '⚠ 對外採光窗／窗框（保留開窗半徑與防水收邊）',
  power_outlet: '⚠ 原有插座／開關迴路（櫃體需預留檢修開孔）',
};

/**
 * Generates a high-resolution PNG data URL of the final simulated room overlaid with:
 * 1. Top contractor title block (space name, area in Ping, scale px/cm, date).
 * 2. Calibration reference line & walkway clearance dimension line (cm).
 * 3. Red warning boxes on locked MEP / structural protection zones.
 * 4. Callout leader labels for surface material specifications (floor, wall, sofa, curtain).
 */
export async function renderConstructionBlueprintDataUrl(params: {
  state: CoreDesignSnapshotState;
  ergonomics: ErgonomicsReport;
}): Promise<string> {
  const { state, ergonomics } = params;
  const {
    scene,
    calibration,
    protectionZones,
    styleConfig,
    materials,
    lighting,
    furniture,
    aiRenderedImageUrl,
    aiRenderMode,
  } = state;

  // 1. Render base composite room onto a staging canvas
  const stageCanvas = document.createElement('canvas');
  await renderCompositeRoomCanvas(stageCanvas, {
    scene,
    styleConfig,
    materials,
    lighting,
    furniture,
    calibration,
    showBeforeOriginalOnly: false,
    rearrangeProposalActive:
      state.activeMode === 'rearrange' && Boolean(state.selectedProposalId),
    aiRenderedImageUrl,
    aiRenderMode,
  });

  const targetW = 1440;
  const aspect = (stageCanvas.width || 1280) / Math.max(1, stageCanvas.height || 800);
  const imgH = Math.round(targetW / aspect);
  const headerH = 74;
  const footerH = 66;
  const totalH = imgH + headerH + footerH;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = targetW;
  outCanvas.height = totalH;
  const ctx = outCanvas.getContext('2d');
  if (!ctx) return '';

  // Background fill
  ctx.fillStyle = '#0F131A';
  ctx.fillRect(0, 0, targetW, totalH);

  // Draw top contractor blueprint header bar
  ctx.fillStyle = '#141923';
  ctx.fillRect(0, 0, targetW, headerH);
  ctx.strokeStyle = '#C89F72';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, headerH);
  ctx.lineTo(targetW, headerH);
  ctx.stroke();

  const styleDef = getStyleById(styleConfig.selectedStyleId);
  ctx.fillStyle = '#E2BE96';
  ctx.font = 'bold 21px "Noto Sans TC", sans-serif';
  ctx.fillText(
    `【工班現場施工與機電尺寸標註圖】${scene.name}（${scene.areaPing} 坪）`,
    24,
    33
  );

  ctx.fillStyle = '#94A3B8';
  ctx.font = '14px "JetBrains Mono", "Noto Sans TC", monospace';
  ctx.fillText(
    `空間尺寸：${scene.roomDimensionsCm.width}×${scene.roomDimensionsCm.depth}×${scene.roomDimensionsCm.height} cm ｜ 比例尺：${calibration.pixelPerCm} px/cm（基準 ${calibration.referenceCm}cm）｜ 風格：${styleDef.nameZh} ｜ 色溫：${lighting.kelvin}K`,
    24,
    58
  );

  // Draw base composite room image in middle viewport
  ctx.save();
  ctx.translate(0, headerH);
  ctx.drawImage(stageCanvas, 0, 0, targetW, imgH);

  // Subtle CAD grid frame border
  ctx.strokeStyle = 'rgba(200, 159, 114, 0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, targetW - 2, imgH - 2);

  // 2. Draw Locked Structural & MEP Red Warning Boxes
  const lockedZones = protectionZones.filter((z) => z.locked && z.points.length >= 2);
  lockedZones.forEach((zone, idx) => {
    const xs = zone.points.map((p) => p.x * targetW);
    const ys = zone.points.map((p) => p.y * imgH);
    const minX = Math.max(8, Math.min(...xs));
    const maxX = Math.min(targetW - 8, Math.max(...xs));
    const minY = Math.max(8, Math.min(...ys));
    const maxY = Math.min(imgH - 8, Math.max(...ys));
    const boxW = Math.max(70, maxX - minX);
    const boxH = Math.max(46, maxY - minY);

    ctx.save();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 6]);
    ctx.fillRect(minX, minY, boxW, boxH);
    ctx.strokeRect(minX, minY, boxW, boxH);
    ctx.setLineDash([]);

    // Diagonal hazard hatching lines
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let offset = 12; offset < boxW + boxH; offset += 18) {
      const x1 = minX + Math.min(offset, boxW);
      const y1 = minY + Math.max(0, offset - boxW);
      const x2 = minX + Math.max(0, offset - boxH);
      const y2 = minY + Math.min(offset, boxH);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();

    // Red Warning Tag Banner
    const tagText = PROTECTION_WARNING_LABELS[zone.category] || `⚠ 嚴禁更動：${zone.label}`;
    ctx.font = 'bold 13px "Noto Sans TC", sans-serif';
    const textW = Math.min(targetW - 24, ctx.measureText(tagText).width + 20);
    const tagX = Math.max(8, Math.min(targetW - textW - 8, minX));
    const tagY = minY > 36 ? minY - 28 : Math.min(imgH - 32, maxY + 6 + (idx % 2) * 26);

    ctx.fillStyle = 'rgba(127, 29, 29, 0.95)';
    ctx.strokeStyle = '#F87171';
    ctx.lineWidth = 1.5;
    ctx.fillRect(tagX, tagY, textW, 24);
    ctx.strokeRect(tagX, tagY, textW, 24);

    ctx.fillStyle = '#FEF2F2';
    ctx.fillText(tagText, tagX + 10, tagY + 17);
    ctx.restore();
  });

  // 3. Draw Calibration Scale Reference Line (Yellow CAD Dimension)
  const sx = calibration.lineStart.x * targetW;
  const sy = calibration.lineStart.y * imgH;
  const ex = calibration.lineEnd.x * targetW;
  const ey = calibration.lineEnd.y * imgH;

  ctx.save();
  ctx.strokeStyle = '#FBBF24';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  // Endpoints
  [
    { x: sx, y: sy },
    { x: ex, y: ey },
  ].forEach((pt) => {
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  const midX = Math.max(130, Math.min(targetW - 130, (sx + ex) / 2));
  const midY = Math.max(28, Math.min(imgH - 28, (sy + ey) / 2));
  const scaleLabel = `比例尺基準：${calibration.referenceCm} cm (${calibration.pixelPerCm} px/cm)`;
  ctx.font = 'bold 13px "JetBrains Mono", "Noto Sans TC", sans-serif';
  const scaleW = ctx.measureText(scaleLabel).width + 22;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
  ctx.strokeStyle = '#FBBF24';
  ctx.lineWidth = 1.8;
  ctx.fillRect(midX - scaleW / 2, midY - 14, scaleW, 28);
  ctx.strokeRect(midX - scaleW / 2, midY - 14, scaleW, 28);
  ctx.fillStyle = '#FDE68A';
  ctx.textAlign = 'center';
  ctx.fillText(scaleLabel, midX, midY + 4);
  ctx.restore();

  // 4. Draw Main Walkway Net Clearance Dimension Line (Bottom Floor Zone)
  const walkY = Math.round(imgH * 0.84);
  const walkX1 = Math.round(targetW * 0.34);
  const walkX2 = Math.round(targetW * 0.66);
  const walkColor =
    ergonomics.walkwayStatus === 'green'
      ? '#34D399'
      : ergonomics.walkwayStatus === 'yellow'
      ? '#FBBF24'
      : '#F87171';

  ctx.save();
  ctx.strokeStyle = walkColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(walkX1, walkY);
  ctx.lineTo(walkX2, walkY);
  // Dimension ticks
  ctx.moveTo(walkX1, walkY - 10);
  ctx.lineTo(walkX1, walkY + 10);
  ctx.moveTo(walkX2, walkY - 10);
  ctx.lineTo(walkX2, walkY + 10);
  ctx.stroke();

  const walkText = `動線走道淨寬：${ergonomics.mainWalkwayCm} cm（標準 ≥75cm）｜ 視聽距離：${ergonomics.viewingDistanceCm} cm`;
  ctx.font = 'bold 13px "JetBrains Mono", "Noto Sans TC", sans-serif';
  const walkBoxW = ctx.measureText(walkText).width + 24;
  const walkMidX = (walkX1 + walkX2) / 2;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
  ctx.strokeStyle = walkColor;
  ctx.lineWidth = 1.8;
  ctx.fillRect(walkMidX - walkBoxW / 2, walkY - 34, walkBoxW, 26);
  ctx.strokeRect(walkMidX - walkBoxW / 2, walkY - 34, walkBoxW, 26);
  ctx.fillStyle = '#F8FAFC';
  ctx.textAlign = 'center';
  ctx.fillText(walkText, walkMidX, walkY - 16);
  ctx.restore();

  // 5. Draw Material Specification Callout Leader Labels
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

  const callouts: Array<{
    title: string;
    spec: string;
    anchorX: number;
    anchorY: number;
    boxX: number;
    boxY: number;
  }> = [
    {
      title: `【地坪施工】${floorMat?.name ?? '超耐磨卡扣木地板（保留或翻新）'}`,
      spec: floorMat
        ? `${floorMat.spec} · NT$${floorMat.priceMinPerUnit.toLocaleString()}–${floorMat.priceMaxPerUnit.toLocaleString()}/${floorMat.unitLabel}`
        : '建議預留 2mm 伸縮縫與防潮靜音墊',
      anchorX: Math.round(targetW * 0.25),
      anchorY: Math.round(imgH * 0.88),
      boxX: 24,
      boxY: Math.round(imgH * 0.75),
    },
    {
      title: `【主牆塗裝】${wallMat?.name ?? `${styleDef.nameZh}低甲醛乳膠漆`}`,
      spec: wallMat
        ? `${wallMat.spec} · NT$${wallMat.priceMinPerUnit.toLocaleString()}–${wallMat.priceMaxPerUnit.toLocaleString()}/${wallMat.unitLabel}`
        : '底漆一底兩度批土打磨，陰陽角垂直校正',
      anchorX: Math.round(targetW * 0.22),
      anchorY: Math.round(imgH * 0.36),
      boxX: 24,
      boxY: Math.round(imgH * 0.16),
    },
    {
      title: `【軟裝織品】${sofaMat?.name ?? '防潑水耐抓亞麻布沙發'}`,
      spec: sofaMat ? sofaMat.spec : `色溫配置 ${lighting.kelvin}K · 預留插座迴路`,
      anchorX: Math.round(targetW * 0.62),
      anchorY: Math.round(imgH * 0.62),
      boxX: targetW - 395,
      boxY: Math.round(imgH * 0.68),
    },
    {
      title: `【窗簾盒／軟裝】${curtainMat?.name ?? '雙層遮光蛇形簾'}`,
      spec: curtainMat
        ? `${curtainMat.spec}`
        : '窗簾盒預留深度 18–22cm，避開冷氣迴風與管線',
      anchorX: Math.round(targetW * 0.78),
      anchorY: Math.round(imgH * 0.32),
      boxX: targetW - 395,
      boxY: Math.round(imgH * 0.14),
    },
  ];

  callouts.forEach((c) => {
    ctx.save();
    const boxW = 370;
    const boxH = 48;

    // Leader line from anchor point to callout box
    const lineEndX = c.boxX < targetW / 2 ? c.boxX + boxW : c.boxX;
    const lineEndY = c.boxY + boxH / 2;

    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(c.anchorX, c.anchorY);
    ctx.lineTo(lineEndX, lineEndY);
    ctx.stroke();

    // Anchor dot
    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.arc(c.anchorX, c.anchorY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Callout Box
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.6;
    ctx.fillRect(c.boxX, c.boxY, boxW, boxH);
    ctx.strokeRect(c.boxX, c.boxY, boxW, boxH);

    ctx.fillStyle = '#E0F2FE';
    ctx.font = 'bold 13px "Noto Sans TC", sans-serif';
    ctx.fillText(c.title, c.boxX + 10, c.boxY + 19);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '11.5px "Noto Sans TC", sans-serif';
    ctx.fillText(c.spec, c.boxX + 10, c.boxY + 38);
    ctx.restore();
  });

  ctx.restore();

  // Draw bottom disclaimer & contractor notes bar
  const footerY = headerH + imgH;
  ctx.fillStyle = '#141923';
  ctx.fillRect(0, footerY, targetW, footerH);
  ctx.strokeStyle = '#2A3241';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, footerY);
  ctx.lineTo(targetW, footerY);
  ctx.stroke();

  ctx.fillStyle = '#FBBF24';
  ctx.font = 'bold 13px "Noto Sans TC", sans-serif';
  ctx.fillText(
    '※ 工班放樣注意事項：紅框標示區為既有配電箱、冷氣排水與結構樑柱鎖定區，木作與系統櫃施工前請現場再次複量水平與管線位置。',
    24,
    footerY + 26
  );

  ctx.fillStyle = '#94A3B8';
  ctx.font = '12px "Noto Sans TC", sans-serif';
  ctx.fillText(
    `※ 免責聲明：本數據僅供表面材與軟裝採購參考，不含拆除、水電重拉等基礎泥作工程 ｜ 製圖日期：${new Date().toLocaleDateString('zh-TW')}`,
    24,
    footerY + 48
  );

  return outCanvas.toDataURL('image/png');
}

export async function downloadConstructionBlueprintPng(params: {
  state: CoreDesignSnapshotState;
  ergonomics: ErgonomicsReport;
}): Promise<string> {
  const dataUrl = await renderConstructionBlueprintDataUrl(params);
  if (!dataUrl) return '';

  const safeScene = params.state.scene.name.replace(/\s+/g, '_');
  const filename = `工班施工標註圖_${safeScene}.png`;

  if (isNativeApp()) {
    try {
      const shared = await saveAndShareNativeBase64Png(filename, dataUrl);
      if (shared) return dataUrl;
    } catch {
      // fall through to browser download
    }
  }

  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return dataUrl;
}
