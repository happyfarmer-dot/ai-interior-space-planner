import { getMaterialById } from '../data/materialsCatalog';
import { getStyleById } from '../data/stylesCatalog';
import type {
  BomLineItem,
  BomReport,
  CustomDesignPrompt,
  FurnitureItem,
  LightingConfig,
  MaterialOverrides,
  RoomScene,
  StyleConfig,
} from '../types/design';

export const BOM_MANDATORY_DISCLAIMER =
  '本數據僅供表面材與軟裝採購參考，不含拆除、水電重拉等基礎泥作工程';

export function calculateBomReport(params: {
  scene: RoomScene;
  furniture: FurnitureItem[];
  styleConfig: StyleConfig;
  materials: MaterialOverrides;
  lighting: LightingConfig;
  customPrompt: CustomDesignPrompt;
}): BomReport {
  const { scene, furniture, styleConfig, materials, lighting, customPrompt } = params;
  const items: BomLineItem[] = [];
  const styleDef = getStyleById(styleConfig.selectedStyleId);

  // Determine effective floor / wall / curtain materials (explicit override takes precedence, else style recommendation if style applied)
  const effectiveFloorId =
    materials.floor ?? (styleConfig.applied ? styleDef.recommendedFloorId : null);
  const effectiveWallId =
    materials.wall ?? (styleConfig.applied ? styleDef.recommendedWallId : null);
  const effectiveCurtainId =
    materials.curtain ?? (styleConfig.applied ? styleDef.recommendedCurtainId : null);
  const effectiveSofaId = materials.sofa;

  const floorPing = Number((scene.areaPing * 1.08).toFixed(1)); // +8% 損耗
  const perimeterM =
    ((scene.roomDimensionsCm.width + scene.roomDimensionsCm.depth) * 2) / 100;
  const wallHeightM = scene.roomDimensionsCm.height / 100;
  // Exclude ~22% window/door opening area, convert m² -> 坪 (* 0.3025)
  const wallPaintPing = Number((perimeterM * wallHeightM * 0.78 * 0.3025).toFixed(1));

  if (effectiveFloorId) {
    const mat = getMaterialById(effectiveFloorId);
    if (mat) {
      items.push({
        id: `bom-floor-${mat.id}`,
        category: '工程表面材',
        name: mat.name,
        spec: mat.spec,
        quantityLabel: `${floorPing} 坪（含 8% 損耗）`,
        unitPriceNote: `NT$ ${mat.priceMinPerUnit.toLocaleString()}–${mat.priceMaxPerUnit.toLocaleString()} / 坪`,
        minTotalTWD: Math.round(floorPing * mat.priceMinPerUnit),
        maxTotalTWD: Math.round(floorPing * mat.priceMaxPerUnit),
      });
    }
  }

  if (effectiveWallId) {
    const mat = getMaterialById(effectiveWallId);
    if (mat) {
      items.push({
        id: `bom-wall-${mat.id}`,
        category: '工程表面材',
        name: mat.name,
        spec: mat.spec,
        quantityLabel: `${wallPaintPing} 坪（立面淨面積）`,
        unitPriceNote: `NT$ ${mat.priceMinPerUnit.toLocaleString()}–${mat.priceMaxPerUnit.toLocaleString()} / 坪`,
        minTotalTWD: Math.round(wallPaintPing * mat.priceMinPerUnit),
        maxTotalTWD: Math.round(wallPaintPing * mat.priceMaxPerUnit),
      });
    }
  }

  if (effectiveCurtainId) {
    const mat = getMaterialById(effectiveCurtainId);
    if (mat) {
      items.push({
        id: `bom-curtain-${mat.id}`,
        category: '軟裝採購',
        name: mat.name,
        spec: mat.spec,
        quantityLabel: '1 窗（含軌道安裝）',
        unitPriceNote: `NT$ ${mat.priceMinPerUnit.toLocaleString()}–${mat.priceMaxPerUnit.toLocaleString()} / 窗`,
        minTotalTWD: mat.priceMinPerUnit,
        maxTotalTWD: mat.priceMaxPerUnit,
      });
    }
  }

  if (effectiveSofaId) {
    const mat = getMaterialById(effectiveSofaId);
    if (mat) {
      items.push({
        id: `bom-sofa-reupholster-${mat.id}`,
        category: '軟裝採購',
        name: `沙發表面重包：${mat.name}`,
        spec: mat.spec,
        quantityLabel: '1 組（三人沙發尺寸）',
        unitPriceNote: `NT$ ${mat.priceMinPerUnit.toLocaleString()}–${mat.priceMaxPerUnit.toLocaleString()} / 組`,
        minTotalTWD: mat.priceMinPerUnit,
        maxTotalTWD: mat.priceMaxPerUnit,
      });
    }
  }

  // Lighting modifications (Feature 8)
  if (lighting.recessedDownlights) {
    items.push({
      id: 'bom-lighting-downlight',
      category: '工程表面材',
      name: `無主燈防眩嵌燈組（${lighting.kelvin}K）`,
      spec: '高演色 Ra>90 LED 嵌燈 × 6 盞（含木作開孔與燈具）',
      quantityLabel: '6 盞',
      unitPriceNote: 'NT$ 1,200–1,800 / 盞',
      minTotalTWD: 7200,
      maxTotalTWD: 10800,
    });
  }

  if (lighting.indirectCoveLight) {
    items.push({
      id: 'bom-lighting-cove',
      category: '工程表面材',
      name: `間接照明軟性 LED 鋁條燈帶（${lighting.kelvin}K）`,
      spec: '鋁槽散熱燈帶 + 變壓器（樑側與電視牆氛圍光）',
      quantityLabel: '8 公尺',
      unitPriceNote: 'NT$ 850–1,350 / 公尺',
      minTotalTWD: 6800,
      maxTotalTWD: 10800,
    });
  }

  // Newly added furniture items (!item.isOriginal)
  const addedFurniture = furniture.filter((f) => !f.isOriginal);
  for (const item of addedFurniture) {
    const basePrice = item.estimatedPriceTWD ?? 9800;
    const minP = Math.round(basePrice * 0.9);
    const maxP = Math.round(basePrice * 1.15);
    items.push({
      id: `bom-furn-${item.id}`,
      category: '軟裝採購',
      name: item.name,
      spec: `尺寸 ${item.widthCm} × ${item.depthCm} × ${item.heightCm} cm${item.materialTag ? `｜${item.materialTag}` : ''}`,
      quantityLabel: '1 件',
      unitPriceNote: `預估市價約 NT$ ${basePrice.toLocaleString()}`,
      minTotalTWD: minP,
      maxTotalTWD: maxP,
    });
  }

  // Style soft-decor allowance when full style transfer is active without added furniture
  if (styleConfig.applied && addedFurniture.length === 0) {
    items.push({
      id: 'bom-style-soft-decor',
      category: '軟裝採購',
      name: `${styleDef.nameZh}軟裝氛圍配置包`,
      spec: '短毛地毯、抱枕織品、掛畫與植栽單品組合',
      quantityLabel: '1 式',
      unitPriceNote: 'NT$ 8,500–15,000 / 式',
      minTotalTWD: 8500,
      maxTotalTWD: 15000,
    });
  }

  // Check if user requested entryway dust zone or extra storage in custom constraints
  if (
    customPrompt.parsedJson.requiredZones.includes('玄關落塵區') &&
    !items.some((i) => i.id.includes('dust-zone'))
  ) {
    items.push({
      id: 'bom-custom-dust-zone',
      category: '工程表面材',
      name: '玄關六角磚／微水泥落塵區拼貼',
      spec: '約 0.6 坪局部換鋪（含不鏽鋼異材質收邊條）',
      quantityLabel: '0.6 坪',
      unitPriceNote: 'NT$ 9,000–14,000 / 式',
      minTotalTWD: 9000,
      maxTotalTWD: 14000,
    });
  }

  const surfaceMinTWD = items
    .filter((i) => i.category === '工程表面材')
    .reduce((acc, i) => acc + i.minTotalTWD, 0);
  const surfaceMaxTWD = items
    .filter((i) => i.category === '工程表面材')
    .reduce((acc, i) => acc + i.maxTotalTWD, 0);
  const softMinTWD = items
    .filter((i) => i.category === '軟裝採購')
    .reduce((acc, i) => acc + i.minTotalTWD, 0);
  const softMaxTWD = items
    .filter((i) => i.category === '軟裝採購')
    .reduce((acc, i) => acc + i.maxTotalTWD, 0);

  const grandMinTWD = surfaceMinTWD + softMinTWD;
  const grandMaxTWD = surfaceMaxTWD + softMaxTWD;
  const budgetCapTWD = customPrompt.parsedJson.maxBudgetTWD;
  const overBudget = budgetCapTWD !== null && grandMinTWD > budgetCapTWD;

  return {
    items,
    surfaceMinTWD,
    surfaceMaxTWD,
    softMinTWD,
    softMaxTWD,
    grandMinTWD,
    grandMaxTWD,
    budgetCapTWD,
    overBudget,
    disclaimer: BOM_MANDATORY_DISCLAIMER,
  };
}
