import type {
  ErgonomicsReport,
  FengShuiCheckResult,
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

function evaluateTaiwanFengShui(
  scene: RoomScene,
  furniture: FurnitureItem[],
  protectionZones: ProtectionZone[]
): FengShuiCheckResult[] {
  const { width: roomW, depth: roomD } = scene.roomDimensionsCm;
  const doorHinge = scene.doorSwing.hingeCm;
  const bed = furniture.find((f) => f.category === 'bed');
  const sofa = furniture.find((f) => f.category === 'sofa');
  const beams = protectionZones.filter((z) => z.category === 'beam_column' && z.locked);
  const windows = protectionZones.filter((z) => z.category === 'window');

  // 1. 開門見灶 / 開門正對主座或床頭
  let doorStoveStatus: TrafficLight = 'green';
  let doorStoveFinding = '房門開啟視線未直沖爐灶、中島或床頭核心私密區。';
  let doorStoveRemedy = '維持目前玄關與主機能區視線錯位即可。';
  const primaryAnchor = bed ?? sofa;
  if (primaryAnchor) {
    const pr = getItemFootprintRect(primaryAnchor);
    const centerX = pr.x + pr.w / 2;
    const centerY = pr.y + pr.d / 2;
    const alignedWithDoor =
      Math.abs(centerX - doorHinge.x) < 65 || Math.abs(centerY - doorHinge.y) < 65;
    if (alignedWithDoor) {
      doorStoveStatus = 'yellow';
      doorStoveFinding = `入口門扇軸線（${doorHinge.x},${doorHinge.y}cm）與「${primaryAnchor.name}」呈直線正對，易有開門見灶／門沖疑慮。`;
      doorStoveRemedy = '建議於入口處增設 45–60cm 長虹玻璃玄關屏風、格柵或高植栽緩衝視線。';
    }
  }

  // 2. 穿堂煞（門窗直線貫穿）
  let throughWindStatus: TrafficLight = 'green';
  let throughWindFinding = '入戶門與對外採光窗呈錯位動線，氣流迴旋聚氣良好。';
  let throughWindRemedy = '無穿堂煞問題，維持窗簾與通風動線。';
  const doorOnRight = doorHinge.x > roomW * 0.65;
  const doorOnLeft = doorHinge.x < roomW * 0.35;
  const doorOnBottom = doorHinge.y > roomD * 0.65;
  const hasDirectWindow =
    (doorOnRight && scene.windowSide === 'left') ||
    (doorOnLeft && scene.windowSide === 'right') ||
    (doorOnBottom && scene.windowSide === 'top') ||
    windows.some((w) => Math.abs(w.topDownRectCm.x - doorHinge.x) < 75);
  const hasScreenBuffer = furniture.some((f) => {
    const fr = getItemFootprintRect(f);
    return fr.x > roomW * 0.25 && fr.x < roomW * 0.75 && f.heightCm >= 90;
  });
  if (hasDirectWindow && !hasScreenBuffer) {
    throughWindStatus = 'yellow';
    throughWindFinding = `入口門扇與${scene.windowSide === 'left' ? '左側' : scene.windowSide === 'right' ? '右側' : '前方'}大面積採光窗形成直線貫穿（穿堂煞）。`;
    throughWindRemedy = '建議於玄關與客廳交界增設半透光屏風、雙面展示櫃或厚實蛇形簾化解穿堂氣流。';
  }

  // 3. 橫樑壓床 / 橫樑壓沙發
  let beamStatus: TrafficLight = 'green';
  let beamFinding = '床頭與主沙發上方皆已避開結構大樑垂直投影區。';
  let beamRemedy = '結構樑位安全，無需額外木作假樑包覆。';
  for (const beam of beams) {
    for (const target of [bed, sofa].filter(Boolean) as FurnitureItem[]) {
      const tr = getItemFootprintRect(target);
      if (rectsOverlap(tr, beam.topDownRectCm, 5)) {
        beamStatus = 'red';
        beamFinding = `「${target.name}」位於「${beam.label}」下方投影區，形成橫樑壓頂壓迫感。`;
        beamRemedy = `建議將${target.name}前移 15–25cm 增設床頭／沙發背櫃避開樑下，或以弧形木作天花加間接燈帶修飾。`;
        break;
      }
    }
  }

  // 4. 鏡子／高反光面正對床鋪或主座
  let mirrorStatus: TrafficLight = 'green';
  let mirrorFinding = '床鋪／主休息區正前方無大面積明鏡直照，睡眠安定度佳。';
  let mirrorRemedy = '若有連身鏡需求，建議整合於衣櫃門片內側或側牆。';
  if (bed) {
    const br = getItemFootprintRect(bed);
    const oppositeItems = furniture.filter(
      (f) => f.category === 'wardrobe' || f.category === 'desk' || /鏡/.test(f.name)
    );
    for (const item of oppositeItems) {
      const ir = getItemFootprintRect(item);
      const facingBed =
        Math.abs(ir.x + ir.w / 2 - (br.x + br.w / 2)) < 95 ||
        Math.abs(ir.y + ir.d / 2 - (br.y + br.d / 2)) < 95;
      if (facingBed) {
        mirrorStatus = 'yellow';
        mirrorFinding = `「${item.name}」正對床鋪方向，若含鏡面或高反光門片易造成夜間驚擾。`;
        mirrorRemedy = '建議改用霧面烤漆／木紋門片，並將穿衣鏡改為拉出式旋轉鏡藏於櫃內。';
        break;
      }
    }
  }

  return [
    {
      ruleId: 'door_stove',
      title: '開門見灶／門沖檢核',
      status: doorStoveStatus,
      finding: doorStoveFinding,
      remedy: doorStoveRemedy,
    },
    {
      ruleId: 'through_wind',
      title: '穿堂煞（門窗直線貫穿）',
      status: throughWindStatus,
      finding: throughWindFinding,
      remedy: throughWindRemedy,
    },
    {
      ruleId: 'beam_over_bed',
      title: '橫樑壓床／壓沙發檢核',
      status: beamStatus,
      finding: beamFinding,
      remedy: beamRemedy,
    },
    {
      ruleId: 'mirror_facing_bed',
      title: '鏡子正對床鋪檢核',
      status: mirrorStatus,
      finding: mirrorFinding,
      remedy: mirrorRemedy,
    },
  ];
}

export function evaluateErgonomics(
  scene: RoomScene,
  furniture: FurnitureItem[],
  protectionZones: ProtectionZone[],
  minWalkwayTargetCm = 75,
  fengShuiMode = false
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

  const pairsToEvaluate: Array<{ gap: number; segA: Point2D; segB: Point2D }> = [];

  for (let i = 0; i < furniture.length; i++) {
    const a = furniture[i];
    const ra = getItemFootprintRect(a);

    for (let j = i + 1; j < furniture.length; j++) {
      const b = furniture[j];
      const isSofaTablePair =
        (a.category === 'sofa' && b.category === 'coffee_table') ||
        (b.category === 'sofa' && a.category === 'coffee_table');
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
    if (zone.category === 'beam_column') {
      for (const item of furniture) {
        if (item.heightCm >= 195 && rectsOverlap(getItemFootprintRect(item), zone.topDownRectCm, -5)) {
          conflicts.push(`${item.name} 高度 (${item.heightCm}cm) 撞及「${zone.label}」`);
        }
      }
      continue;
    }

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

  const fengShuiChecks = fengShuiMode
    ? evaluateTaiwanFengShui(scene, furniture, protectionZones)
    : undefined;

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
    fengShuiChecks,
    overallScore: score,
    summaryText,
  };
}
