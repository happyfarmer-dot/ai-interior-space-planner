import type {
  ErgonomicsReport,
  FurnitureItem,
  Point2D,
  ProtectionZone,
  RoomScene,
  TrafficLight,
} from '../types/design';
import {
  doesRectIntersectDoorSwing,
  getItemFootprintRect,
  rectGapCm,
  rectsOverlap,
} from './geometry';

function snapRecommendedTvInches(distCm: number): string {
  // 4K ergonomic viewing distance: 1.6x to 2.05x screen diagonal (1 inch = 2.54 cm)
  const idealMinIn = Math.round(distCm / (2.05 * 2.54));
  const idealMaxIn = Math.round(distCm / (1.6 * 2.54));
  const sizes = [43, 50, 55, 65, 75, 85];
  const low = sizes.find((s) => s >= idealMinIn) ?? 43;
  const high = [...sizes].reverse().find((s) => s <= idealMaxIn) ?? low;
  if (high <= low) return `${low}"`;
  return `${low}" – ${high}"`;
}

export function evaluateErgonomics(
  scene: RoomScene,
  furniture: FurnitureItem[],
  protectionZones: ProtectionZone[],
  minWalkwayTargetCm = 75
): ErgonomicsReport {
  const { width: roomW, depth: roomD } = scene.roomDimensionsCm;

  // 1. Check door swing clearance & wardrobe door swing clearance
  let doorSwingClear = true;
  let doorConflictItem: string | null = null;
  for (const item of furniture) {
    const rect = getItemFootprintRect(item);
    if (doesRectIntersectDoorSwing(rect, scene.doorSwing)) {
      doorSwingClear = false;
      doorConflictItem = `${item.name} 阻擋「${scene.doorSwing.label}」`;
      break;
    }
  }

  // Also check wardrobe front clearance (60cm swing zone) if any wardrobe exists
  if (doorSwingClear) {
    const wardrobes = furniture.filter((f) => f.category === 'wardrobe');
    for (const w of wardrobes) {
      const wr = getItemFootprintRect(w);
      const swingZone = {
        x: Math.max(0, wr.x - 55),
        y: wr.y,
        w: wr.w + 55,
        d: wr.d + 55,
      };
      for (const other of furniture) {
        if (other.id === w.id) continue;
        const or = getItemFootprintRect(other);
        if (rectsOverlap(swingZone, or, -4)) {
          const gap = rectGapCm(wr, or);
          if (gap.distance < 55) {
            doorSwingClear = false;
            doorConflictItem = `${other.name} 距離衣櫃僅 ${gap.distance}cm，櫃門開啟受阻`;
            break;
          }
        }
      }
    }
  }

  // 2. Compute main traffic walkway clearance (between furniture & key circulation lanes)
  let mainWalkwayCm = 115;
  let walkwaySegmentCm: [Point2D, Point2D] = [
    { x: Math.round(roomW * 0.45), y: Math.round(roomD * 0.35) },
    { x: Math.round(roomW * 0.45) + 115, y: Math.round(roomD * 0.35) },
  ];

  // Key practical walkway checks:
  // a) Between major seating/bed and opposite table/wall/added items
  const pairsToEvaluate: Array<{ gap: number; segA: Point2D; segB: Point2D }> = [];

  for (let i = 0; i < furniture.length; i++) {
    const a = furniture[i];
    const ra = getItemFootprintRect(a);

    for (let j = i + 1; j < furniture.length; j++) {
      const b = furniture[j];
      // Coffee table in front of sofa intentionally sits ~40-50cm for reachability — NOT main corridor!
      const isSofaTablePair =
        (a.category === 'sofa' && b.category === 'coffee_table') ||
        (b.category === 'sofa' && a.category === 'coffee_table');
      // Bed + bedside nightstand intentionally sit adjacent
      const isBedNightstandPair =
        (a.category === 'bed' && b.category === 'nightstand') ||
        (b.category === 'bed' && a.category === 'nightstand');

      if (isSofaTablePair || isBedNightstandPair) continue;

      const rb = getItemFootprintRect(b);
      const res = rectGapCm(ra, rb);
      if (res.distance > 0) {
        pairsToEvaluate.push({ gap: res.distance, segA: res.segA, segB: res.segB });
      } else {
        pairsToEvaluate.push({ gap: 0, segA: res.segA, segB: res.segB });
      }
    }

    // Check clearance against opposite side boundaries when item floats away from walls (>42cm off wall)
    const leftGap = ra.x;
    const rightGap = roomW - (ra.x + ra.w);
    const bottomGap = roomD - (ra.y + ra.d);
    if (leftGap > 42 && leftGap < 120) {
      pairsToEvaluate.push({
        gap: Math.round(leftGap),
        segA: { x: 0, y: ra.y + ra.d / 2 },
        segB: { x: ra.x, y: ra.y + ra.d / 2 },
      });
    }
    if (rightGap > 42 && rightGap < 120) {
      pairsToEvaluate.push({
        gap: Math.round(rightGap),
        segA: { x: ra.x + ra.w, y: ra.y + ra.d / 2 },
        segB: { x: roomW, y: ra.y + ra.d / 2 },
      });
    }
    if (bottomGap > 42 && bottomGap < 110) {
      pairsToEvaluate.push({
        gap: Math.round(bottomGap),
        segA: { x: ra.x + ra.w / 2, y: ra.y + ra.d },
        segB: { x: ra.x + ra.w / 2, y: roomD },
      });
    }
  }

  if (pairsToEvaluate.length > 0) {
    pairsToEvaluate.sort((x, y) => x.gap - y.gap);
    const tightest = pairsToEvaluate[0];
    mainWalkwayCm = tightest.gap;
    walkwaySegmentCm = [tightest.segA, tightest.segB];
  }

  let walkwayStatus: TrafficLight = 'green';
  if (mainWalkwayCm < 60) {
    walkwayStatus = 'red';
  } else if (mainWalkwayCm < Math.max(75, minWalkwayTargetCm)) {
    walkwayStatus = 'yellow';
  }

  // 3. Viewing Distance Check (Sofa/Bed to TV Console or TV Wall)
  const sofa = furniture.find((f) => f.category === 'sofa') ?? furniture.find((f) => f.category === 'bed');
  const tvConsole = furniture.find((f) => f.category === 'tv_console');

  let viewingDistanceCm = 260;
  if (sofa) {
    const sr = getItemFootprintRect(sofa);
    const sofaCenter: Point2D = { x: sr.x + sr.w / 2, y: sr.y + sr.d / 2 };
    const target: Point2D = tvConsole
      ? {
          x: getItemFootprintRect(tvConsole).x + getItemFootprintRect(tvConsole).w / 2,
          y: getItemFootprintRect(tvConsole).y + getItemFootprintRect(tvConsole).d / 2,
        }
      : scene.tvWallCenterCm;
    viewingDistanceCm = Math.round(Math.hypot(sofaCenter.x - target.x, sofaCenter.y - target.y));
  }

  const recommendedTvInches = snapRecommendedTvInches(viewingDistanceCm);
  let tvDistanceStatus: TrafficLight = 'green';
  if (viewingDistanceCm < 165 || viewingDistanceCm > 420) {
    tvDistanceStatus = 'yellow';
  }
  if (viewingDistanceCm < 130) {
    tvDistanceStatus = 'red';
  }

  // 4. MEP & Structural Protection Collision Check
  const lockedZones = protectionZones.filter((z) => z.locked);
  const conflicts: string[] = [];

  for (const zone of lockedZones) {
    // Beams overhead don't block low seating/tables unless tall cabinet/wardrobe (>200cm)
    if (zone.category === 'beam_column') {
      for (const item of furniture) {
        if (item.heightCm >= 195 && rectsOverlap(getItemFootprintRect(item), zone.topDownRectCm, -5)) {
          conflicts.push(`${item.name} 高度 (${item.heightCm}cm) 撞及「${zone.label}」`);
        }
      }
      continue;
    }

    // AC units don't block low items (<170cm), but block tall wardrobes/cat trees >165cm
    if (zone.category === 'ac_unit') {
      for (const item of furniture) {
        if (
          item.heightCm >= 165 &&
          rectsOverlap(getItemFootprintRect(item), zone.topDownRectCm, 12)
        ) {
          conflicts.push(`${item.name} 遮擋「${zone.label}」出風口`);
        }
      }
      continue;
    }

    // Windows: high cabinets/wardrobes (>130cm) shouldn't block windows; low seating/cat tree okay with buffer unless touching tightly
    if (zone.category === 'window') {
      for (const item of furniture) {
        if (
          (item.category === 'wardrobe' || item.category === 'storage_cabinet' || item.heightCm > 135) &&
          rectsOverlap(getItemFootprintRect(item), zone.topDownRectCm, 10)
        ) {
          conflicts.push(`${item.name} 遮蔽「${zone.label}」採光面`);
        }
      }
      continue;
    }

    // Electrical panel: strictly require clearance in front of panel for tall or fixed heavy items
    if (zone.category === 'electrical_panel') {
      for (const item of furniture) {
        if (
          item.heightCm > 105 &&
          rectsOverlap(getItemFootprintRect(item), zone.topDownRectCm, 25)
        ) {
          conflicts.push(`${item.name} 阻擋「${zone.label}」維修開啟`);
        }
      }
    }
  }

  // Calculate Overall Ergonomics Score (0..100)
  let score = 96;
  if (walkwayStatus === 'yellow') score -= 12;
  if (walkwayStatus === 'red') score -= 28;
  if (!doorSwingClear) score -= 22;
  if (tvDistanceStatus === 'yellow') score -= 6;
  if (tvDistanceStatus === 'red') score -= 14;
  score -= conflicts.length * 15;
  score = Math.max(25, Math.min(99, score));

  const summaryText =
    walkwayStatus === 'green' && doorSwingClear && conflicts.length === 0
      ? `空間動線流暢（最小淨寬 ${mainWalkwayCm}cm），門片開啟無干涉，且完全避開 ${lockedZones.length} 處機電結構鎖定區。`
      : `偵測到 ${
          [
            walkwayStatus !== 'green' ? `走道淨寬僅 ${mainWalkwayCm}cm` : null,
            !doorSwingClear ? '門片開啟干涉' : null,
            conflicts.length > 0 ? `${conflicts.length} 處機電遮擋` : null,
          ]
            .filter(Boolean)
            .join('、')
        }，建議微調家具配置。`;

  return {
    mainWalkwayCm,
    walkwayStatus,
    walkwaySegmentCm,
    doorSwingClear,
    doorConflictItem,
    viewingDistanceCm,
    recommendedTvInches,
    tvDistanceStatus,
    mepProtectionStatus: {
      lockedCount: lockedZones.length,
      conflictCount: conflicts.length,
      conflicts,
    },
    overallScore: score,
    summaryText,
  };
}
