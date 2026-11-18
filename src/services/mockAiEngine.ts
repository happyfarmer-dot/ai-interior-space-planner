import { PRODUCTS_CATALOG } from '../data/productsCatalog';
import type {
  FurnitureItem,
  HighlightZone,
  ParsedDesignConstraints,
  Point2D,
  ProtectionZone,
  RearrangementProposal,
  RoomScene,
  StyleId,
  VisualSearchMatch,
} from '../types/design';
import { evaluateErgonomics } from '../utils/ergonomics';
import { doesRectIntersectDoorSwing, getItemFootprintRect, rectsOverlap } from '../utils/geometry';

export function parseConstraintsMock(
  freeText: string,
  selectedTags: string[]
): ParsedDesignConstraints {
  const combined = `${selectedTags.join(' ')} ${freeText}`.trim();

  // Extract budget in TWD (e.g. "30 萬", "30萬台幣", "250000", "250,000")
  let maxBudgetTWD: number | null = null;
  const wanMatch = combined.match(/(\d+(?:\.\d+)?)\s*萬/);
  if (wanMatch) {
    maxBudgetTWD = Math.round(parseFloat(wanMatch[1]) * 10000);
  } else {
    const rawNumMatch = combined.match(/(\d{2,3},?\d{3})\s*(?:元|台幣|TWD)?/);
    if (rawNumMatch) {
      maxBudgetTWD = parseInt(rawNumMatch[1].replace(/,/g, ''), 10);
    }
  }

  const petFriendly = /貓|狗|寵物|防抓|耐磨/.test(combined);
  const catTreeRequired = /貓跳台|貓爬架|兩隻貓|養貓/.test(combined);

  const preserveItems: string[] = [];
  if (/實木餐桌|原木餐桌|保留餐桌/.test(combined)) preserveItems.push('原有實木餐桌');
  if (/保留.*沙發|原有沙發/.test(combined)) preserveItems.push('現有沙發');
  if (/保留.*茶幾|原有茶幾/.test(combined)) preserveItems.push('現有實木茶幾');
  if (/保留.*衣櫃|原有衣櫃/.test(combined)) preserveItems.push('現有衣櫃');
  if (/保留.*床|原有床/.test(combined)) preserveItems.push('現有雙人床架');

  const requiredZones: string[] = [];
  if (/玄關|落塵區/.test(combined)) requiredZones.push('玄關落塵區');
  if (/收納|儲藏|系統櫃/.test(combined)) requiredZones.push('高機能系統收納區');
  if (/書桌|辦公|WFH|工作區/.test(combined)) requiredZones.push('居家辦公書桌區');
  if (catTreeRequired) requiredZones.push('寵物貓跳台垂直動線區');

  const materialRestrictions: string[] = [];
  if (petFriendly) {
    materialRestrictions.push('禁選易勾紗絨布 / 須採防抓耐磨布料（>10萬轉）');
    materialRestrictions.push('地坪建議超耐磨木地板或無縫微水泥');
  }
  if (/圓角|親子|小孩|兒童/.test(combined)) {
    materialRestrictions.push('茶幾與邊櫃優先選用圓角防撞設計');
  }
  if (/防潮|除濕|過敏/.test(combined)) {
    materialRestrictions.push('優先採用低甲醛 F1 板材與礦物調濕塗料');
  }

  const minWalkwayCm = /無障礙|寬走道|輪椅|推車/.test(combined) ? 90 : 75;
  const storagePriority = /大量收納|極大化收納|收納櫃/.test(combined)
    ? 'high'
    : /收納/.test(combined)
    ? 'medium'
    : 'low';

  const notes: string[] = [];
  if (maxBudgetTWD) {
    notes.push(`已設定表面材＋軟裝總預算警戒上限 NT$ ${maxBudgetTWD.toLocaleString()}`);
  }
  if (petFriendly) {
    notes.push('啟動寵物友善約束：材質庫與商品檢索將自動標記耐抓防水材質');
  }
  if (preserveItems.length > 0) {
    notes.push(`已鎖定保留原有家具：${preserveItems.join('、')}`);
  }
  if (requiredZones.length > 0) {
    notes.push(`優先配置機能分區：${requiredZones.join('、')}`);
  }

  return {
    maxBudgetTWD,
    petFriendly,
    catTreeRequired,
    preserveItems,
    minWalkwayCm,
    requiredZones,
    materialRestrictions,
    storagePriority,
    notes,
  };
}

export function generateRearrangementProposalsMock(
  scene: RoomScene,
  currentFurniture: FurnitureItem[],
  protectionZones: ProtectionZone[],
  constraints: ParsedDesignConstraints
): RearrangementProposal[] {
  const base = currentFurniture.map((f) => ({
    ...f,
    topDownPosCm: { ...f.topDownPosCm },
    imagePos: { ...f.imagePos },
    bboxNorm: { ...f.bboxNorm },
  }));

  const cloneWithUpdates = (
    updates: Record<string, Partial<FurnitureItem>>,
    extraItems: FurnitureItem[] = []
  ): FurnitureItem[] => {
    const mapped = base.map((item) => {
      const patch = updates[item.id] || updates[item.category];
      if (!patch) return item;
      return {
        ...item,
        ...patch,
        topDownPosCm: patch.topDownPosCm
          ? { ...item.topDownPosCm, ...patch.topDownPosCm }
          : item.topDownPosCm,
        imagePos: patch.imagePos ? { ...item.imagePos, ...patch.imagePos } : item.imagePos,
      };
    });
    return [...mapped, ...extraItems];
  };

  if (scene.id === 'bedroom') {
    const layoutA = cloneWithUpdates({
      'furn-bed-orig': {
        topDownPosCm: { x: 108, y: 12, rotationDeg: 0 },
        imagePos: { x: 0.59, y: 0.87, scale: 1 },
      },
      'furn-nightstand-orig': {
        topDownPosCm: { x: 52, y: 12, rotationDeg: 0 },
        imagePos: { x: 0.40, y: 0.76, scale: 1 },
      },
      'furn-wardrobe-orig': {
        topDownPosCm: { x: 8, y: 15, rotationDeg: 0 },
        imagePos: { x: 0.25, y: 0.65, scale: 1 },
      },
    });

    const layoutB = cloneWithUpdates(
      {
        'furn-bed-orig': {
          topDownPosCm: { x: 16, y: 78, rotationDeg: 90 },
          imagePos: { x: 0.43, y: 0.85, scale: 1 },
        },
        'furn-nightstand-orig': {
          topDownPosCm: { x: 16, y: 24, rotationDeg: 90 },
          imagePos: { x: 0.31, y: 0.72, scale: 1 },
        },
        'furn-wardrobe-orig': {
          topDownPosCm: { x: 256, y: 265, rotationDeg: 90 },
          imagePos: { x: 0.76, y: 0.78, scale: 1 },
        },
      },
      constraints.requiredZones.includes('居家辦公書桌區')
        ? [
            {
              id: 'furn-desk-prop-b',
              name: '新增靠窗採光書桌',
              category: 'desk',
              widthCm: 110,
              depthCm: 55,
              heightCm: 75,
              topDownPosCm: { x: 240, y: 95, rotationDeg: 90 },
              imagePos: { x: 0.82, y: 0.72, scale: 1 },
              bboxNorm: { x: 0.75, y: 0.56, w: 0.14, h: 0.18 },
              isOriginal: false,
              isPreserved: false,
              materialTag: '白橡木實木',
              estimatedPriceTWD: 6900,
              colorHex: '#CFAF86',
            },
          ]
        : []
    );

    return [
      {
        id: 'prop-bed-a',
        title: '方案 A｜避開冷氣直吹・雙側下床動線',
        subtitle: '衣櫃移至左側內牆，釋放右側窗邊採光與冷氣迴風空間',
        score: 94,
        tags: ['採光極大化', '冷氣零直吹', '動線流暢'],
        rationale: [
          '將衣櫃自右窗角移至左牆，徹底解除衣櫃遮擋氣密窗光線與冷氣出風口的問題。',
          '床頭維持避開右側窗風，保留床尾 > 140cm 寬裕走道並完全避開房門開啟半徑。',
        ],
        furnitureLayout: layoutA,
        ergonomics: evaluateErgonomics(scene, layoutA, protectionZones, constraints.minWalkwayCm),
      },
      {
        id: 'prop-bed-b',
        title: '方案 B｜靠窗書桌與流暢環狀格局',
        subtitle: '床組轉向配置，留出右側自然光工作／梳妝機能區',
        score: 89,
        tags: ['增加窗邊機能', '動線零干涉'],
        rationale: [
          '床組旋轉 90° 貼齊左側主牆，釋放整面右側採光帶，提供最佳閱讀與辦公照度。',
          '衣櫃置於右下方實牆段落，避開大門開啟弧線，維持主走道淨寬 ≥ 80cm。',
        ],
        furnitureLayout: layoutB,
        ergonomics: evaluateErgonomics(scene, layoutB, protectionZones, constraints.minWalkwayCm),
      },
    ];
  }

  // Living Room (and generic uploaded room) 3 Distinct Rearrangement Proposals
  const layout1 = cloneWithUpdates({
    'furn-sofa-orig': {
      topDownPosCm: { x: 286, y: 120, rotationDeg: 90 },
      imagePos: { x: 0.74, y: 0.82, scale: 1 },
    },
    'furn-ct-orig': {
      topDownPosCm: { x: 192, y: 178, rotationDeg: 90 },
      imagePos: { x: 0.56, y: 0.82, scale: 1 },
    },
    'furn-tv-orig': {
      topDownPosCm: { x: 14, y: 155, rotationDeg: 90 },
      imagePos: { x: 0.36, y: 0.72, scale: 1 },
    },
  });

  const layout2 = cloneWithUpdates(
    {
      'furn-sofa-orig': {
        topDownPosCm: { x: 105, y: 14, rotationDeg: 0 },
        imagePos: { x: 0.50, y: 0.70, scale: 0.92 },
      },
      'furn-ct-orig': {
        topDownPosCm: { x: 155, y: 148, rotationDeg: 0 },
        imagePos: { x: 0.50, y: 0.80, scale: 0.95 },
      },
      'furn-tv-orig': {
        topDownPosCm: { x: 130, y: 405, rotationDeg: 0 },
        imagePos: { x: 0.48, y: 0.93, scale: 1.05 },
      },
    },
    constraints.storagePriority !== 'low'
      ? [
          {
            id: 'furn-storage-prop2',
            name: '靠右牆高機能系統收納櫃',
            category: 'storage_cabinet',
            widthCm: 120,
            depthCm: 38,
            heightCm: 165,
            topDownPosCm: { x: 334, y: 135, rotationDeg: 90 },
            imagePos: { x: 0.78, y: 0.76, scale: 1 },
            bboxNorm: { x: 0.68, y: 0.42, w: 0.14, h: 0.36 },
            isOriginal: false,
            isPreserved: false,
            materialTag: '白橡木低甲醛板材',
            estimatedPriceTWD: 15800,
            colorHex: '#D5BA92',
          },
        ]
      : []
  );

  const layout3 = cloneWithUpdates(
    {
      'furn-sofa-orig': {
        topDownPosCm: { x: 75, y: 125, rotationDeg: 90 },
        imagePos: { x: 0.40, y: 0.78, scale: 0.96 },
      },
      'furn-ct-orig': {
        topDownPosCm: { x: 205, y: 185, rotationDeg: 90 },
        imagePos: { x: 0.58, y: 0.83, scale: 1 },
      },
      'furn-tv-orig': {
        topDownPosCm: { x: 326, y: 150, rotationDeg: 90 },
        imagePos: { x: 0.76, y: 0.78, scale: 1 },
      },
    },
    constraints.catTreeRequired
      ? [
          {
            id: 'furn-cattree-prop3',
            name: '窗邊陽光景觀貓跳台',
            category: 'cat_tree',
            widthCm: 60,
            depthCm: 55,
            heightCm: 145,
            topDownPosCm: { x: 35, y: 365, rotationDeg: 0 },
            imagePos: { x: 0.25, y: 0.89, scale: 1 },
            bboxNorm: { x: 0.19, y: 0.54, w: 0.12, h: 0.36 },
            spriteUrl: './samples/item-cat-tree.jpg',
            isOriginal: false,
            isPreserved: false,
            materialTag: '樺木＋黃麻抓柱',
            estimatedPriceTWD: 6490,
            colorHex: '#DFC7A2',
          },
        ]
      : []
  );

  const proposals: RearrangementProposal[] = [
    {
      id: 'prop-living-1',
      title: '方案 A｜採光通風極大化配置（推薦）',
      subtitle: '拉開沙發與茶幾間距並退離門扇，淨化進入室內的視覺軸線',
      score: 96,
      tags: ['不更換現有家具', '最寬敞走道', '完全避開配電箱'],
      rationale: [
        '將三人沙發往內牆前段微調 35cm，徹底避開右前側實木房門 88cm 開啟半徑與總配電箱下方檢修區。',
        '保留左側落地窗前 45cm 以上自然採光與通風走廊，避免陽光直射電視螢幕造成反光眩光。',
        '沙發至電視距離調整為約 275cm，完美匹配 55"–65" 4K 最佳視聽比例。',
      ],
      furnitureLayout: layout1,
      ergonomics: evaluateErgonomics(scene, layout1, protectionZones, constraints.minWalkwayCm),
    },
    {
      id: 'prop-living-2',
      title: '方案 B｜視覺橫軸對稱＋高收納機能動線',
      subtitle: '沙發靠底牆形成縱深客廳動線，右側牆面釋放大型收納空間',
      score: 91,
      tags: ['極大化收納牆', '縱深視角', '避開結構樑壓迫'],
      rationale: [
        '沙發轉向靠後側主牆，讓出右側長牆面可配置或保留系統收納櫃（嚴格停駐於配電箱前段，無遮擋）。',
        '從陽台採光窗平行引入橫向自然光，降低背光看電視的對比疲勞。',
        '左前側留下充裕的落塵／活動腹地，雙向出入動線淨寬均維持 85cm 以上。',
      ],
      furnitureLayout: layout2,
      ergonomics: evaluateErgonomics(scene, layout2, protectionZones, constraints.minWalkwayCm),
    },
    {
      id: 'prop-living-3',
      title: '方案 C｜面向實體背牆電視軸線・窗邊環狀動線',
      subtitle: '電視櫃靠右側無窗實牆解決反光，沙發背窗留出 75cm 景觀/寵物走廊',
      score: 88,
      tags: ['零反光視聽', '窗邊環狀走廊', ...(constraints.petFriendly ? ['寵物日曬動線'] : [])],
      rationale: [
        '電視改置於右側實牆（高度低於 100cm，完全不遮擋上方總配電箱），徹底消除白天看電視反光。',
        '沙發離左側落地窗保留 75cm 環狀走廊，方便陽台出入、清潔與放置貓咪曬太陽區域。',
      ],
      furnitureLayout: layout3,
      ergonomics: evaluateErgonomics(scene, layout3, protectionZones, constraints.minWalkwayCm),
    },
  ];

  return proposals;
}

export function analyzeHighlightZonesMock(
  scene: RoomScene,
  itemW: number,
  itemD: number,
  protectionZones: ProtectionZone[],
  existingFurniture: FurnitureItem[]
): HighlightZone[] {
  const { width: roomW, depth: roomD } = scene.roomDimensionsCm;

  // Candidate strategic interior zones (normalized anchor + topDownCm candidate)
  const candidates: Array<{
    id: string;
    label: string;
    reason: string;
    imageAnchor: Point2D;
    perspectiveScale: number;
    topDownPosCm: { x: number; y: number; rotationDeg: number };
    footprintPolyNorm: Point2D[];
  }> =
    scene.id === 'bedroom'
      ? [
          {
            id: 'zone-bed-window',
            label: '建議區 1：右窗旁採光閱讀角',
            reason: '自然日照充足、不阻擋臥室房門半徑與床尾動線',
            imageAnchor: { x: 0.81, y: 0.84 },
            perspectiveScale: 0.96,
            topDownPosCm: { x: 245, y: 235, rotationDeg: 0 },
            footprintPolyNorm: [
              { x: 0.72, y: 0.78 },
              { x: 0.90, y: 0.78 },
              { x: 0.93, y: 0.91 },
              { x: 0.73, y: 0.91 },
            ],
          },
          {
            id: 'zone-bed-corner',
            label: '建議區 2：左側牆面內緣端景區',
            reason: '位於門片開啟範圍之外，適合立式單品或直立收納',
            imageAnchor: { x: 0.27, y: 0.83 },
            perspectiveScale: 0.94,
            topDownPosCm: { x: 18, y: 160, rotationDeg: 0 },
            footprintPolyNorm: [
              { x: 0.20, y: 0.77 },
              { x: 0.35, y: 0.77 },
              { x: 0.36, y: 0.89 },
              { x: 0.19, y: 0.89 },
            ],
          },
        ]
      : [
          {
            id: 'zone-living-window',
            label: '建議區 1：陽台窗旁畸零角（推薦）',
            reason: '緊鄰自然採光面且遠離大門開啟半徑與配電箱，走道淨寬維持充裕',
            imageAnchor: { x: 0.28, y: 0.91 },
            perspectiveScale: 1.0,
            topDownPosCm: { x: 28, y: 384, rotationDeg: 0 },
            footprintPolyNorm: [
              { x: 0.19, y: 0.85 },
              { x: 0.37, y: 0.85 },
              { x: 0.35, y: 0.97 },
              { x: 0.15, y: 0.97 },
            ],
          },
          {
            id: 'zone-living-backcorner',
            label: '建議區 2：底牆右側安全留白角',
            reason: '避開分離式冷氣正下方風道與配電箱，與主沙發形成 L 型交談圍塑',
            imageAnchor: { x: 0.62, y: 0.75 },
            perspectiveScale: 0.76,
            topDownPosCm: { x: 245, y: 24, rotationDeg: 0 },
            footprintPolyNorm: [
              { x: 0.56, y: 0.71 },
              { x: 0.68, y: 0.71 },
              { x: 0.70, y: 0.79 },
              { x: 0.57, y: 0.79 },
            ],
          },
          {
            id: 'zone-living-midleft',
            label: '建議區 3：電視牆後段緩衝角',
            reason: '利用背牆深度填補畸零角落，不遮蔽落地窗出入軌道',
            imageAnchor: { x: 0.44, y: 0.74 },
            perspectiveScale: 0.74,
            topDownPosCm: { x: 96, y: 24, rotationDeg: 0 },
            footprintPolyNorm: [
              { x: 0.38, y: 0.70 },
              { x: 0.50, y: 0.70 },
              { x: 0.51, y: 0.78 },
              { x: 0.38, y: 0.78 },
            ],
          },
        ];

  return candidates.map((c, idx) => {
    const candidateRect = {
      x: Math.min(roomW - itemW - 8, c.topDownPosCm.x),
      y: Math.min(roomD - itemD - 8, c.topDownPosCm.y),
      w: itemW,
      d: itemD,
    };

    const hitsDoor = doesRectIntersectDoorSwing(candidateRect, scene.doorSwing);
    const hitsFurniture = existingFurniture.some((f) =>
      rectsOverlap(candidateRect, getItemFootprintRect(f), 6)
    );
    const hitsMep = protectionZones.some(
      (z) =>
        z.locked &&
        z.category !== 'beam_column' &&
        rectsOverlap(candidateRect, z.topDownRectCm, 5)
    );

    let fitScore = 95 - idx * 5;
    if (hitsDoor) fitScore -= 32;
    if (hitsFurniture) fitScore -= 25;
    if (hitsMep) fitScore -= 22;

    return {
      ...c,
      topDownPosCm: {
        ...c.topDownPosCm,
        x: Math.max(8, candidateRect.x),
        y: Math.max(8, candidateRect.y),
      },
      fitScore: Math.max(40, fitScore),
      mepSafe: !hitsMep && !hitsDoor,
      reason:
        hitsDoor || hitsMep
          ? `注意：此區域鄰近門片/保護區（建議微調尺吋），${c.reason}`
          : c.reason,
    };
  });
}

export function visualSearchMock(
  furniture: FurnitureItem[],
  activeStyle: StyleId,
  petFriendly: boolean
): VisualSearchMatch[] {
  return furniture
    .filter((f) => f.category !== 'desk')
    .map((slot) => {
      const candidates = PRODUCTS_CATALOG.filter((p) => p.category === slot.category);
      const pool =
        candidates.length > 0
          ? candidates
          : PRODUCTS_CATALOG.filter((p) => p.category === 'storage_cabinet');

      const ranked = pool
        .map((prod) => {
          const widthDiff = Math.abs(prod.widthCm - slot.widthCm);
          const depthDiff = Math.abs(prod.depthCm - slot.depthCm);
          const dimPenalty = (widthDiff + depthDiff) * 0.25;
          const styleBonus = prod.styleAffinity.includes(activeStyle) ? 10 : 0;
          const petBonus = petFriendly ? (prod.petScratchResistant ? 12 : -15) : 0;
          const fitScore = Math.max(55, Math.min(99, Math.round(90 - dimPenalty + styleBonus + petBonus)));

          let dimDiffNote = '尺寸與現況估算完美契合';
          if (prod.widthCm - slot.widthCm > 10) {
            dimDiffNote = `寬度多出 +${prod.widthCm - slot.widthCm}cm（需留意走道）`;
          } else if (slot.widthCm - prod.widthCm > 10) {
            dimDiffNote = `寬度精簡 -${slot.widthCm - prod.widthCm}cm（動線更寬裕）`;
          } else {
            dimDiffNote = `寬度誤差僅 ±${widthDiff}cm・完美吻合`;
          }

          return {
            product: prod,
            fitScore,
            dimDiffNote,
          };
        })
        .sort((a, b) => b.fitScore - a.fitScore)
        .slice(0, 3);

      return {
        slotId: slot.id,
        slotLabel: slot.name,
        bboxNorm: slot.bboxNorm,
        estimatedDimsCm: {
          w: slot.widthCm,
          d: slot.depthCm,
          h: slot.heightCm,
        },
        matches: ranked,
      };
    });
}
