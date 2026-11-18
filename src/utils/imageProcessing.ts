import { getMaterialById } from '../data/materialsCatalog';
import { getStyleById } from '../data/stylesCatalog';
import type {
  FurnitureItem,
  LightingConfig,
  MaterialOption,
  MaterialOverrides,
  Point2D,
  RoomScene,
  ScaleCalibration,
  StyleConfig,
} from '../types/design';

const imageCache = new Map<string, HTMLImageElement>();

export function loadImageCached(url: string): Promise<HTMLImageElement> {
  const existing = imageCache.get(url);
  if (existing && existing.complete && existing.naturalWidth > 0) {
    return Promise.resolve(existing);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

/**
 * Flood-fill from image borders to remove uniform light/white studio backgrounds
 * without erasing interior bright highlights of the furniture item itself.
 */
export async function autoRemoveWhiteBackground(
  imageUrl: string,
  threshold = 38
): Promise<string> {
  const img = await loadImageCached(imageUrl);
  const maxDim = 512;
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return imageUrl;

  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Sample average corner color as background reference
  const cornerIdx = [
    0,
    (w - 1) * 4,
    (h - 1) * w * 4,
    ((h - 1) * w + (w - 1)) * 4,
  ];
  let refR = 0;
  let refG = 0;
  let refB = 0;
  for (const idx of cornerIdx) {
    refR += data[idx];
    refG += data[idx + 1];
    refB += data[idx + 2];
  }
  refR /= 4;
  refG /= 4;
  refB /= 4;

  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;

  const isBgLike = (pIdx: number): boolean => {
    const i = pIdx * 4;
    const dr = data[i] - refR;
    const dg = data[i + 1] - refG;
    const db = data[i + 2] - refB;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    // Also tolerate soft light floor contact shadow near edges
    const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const maxCh = Math.max(data[i], data[i + 1], data[i + 2]);
    const minCh = Math.min(data[i], data[i + 1], data[i + 2]);
    const sat = maxCh - minCh;
    return dist <= threshold || (lum > 218 && sat < 18 && dist <= threshold * 1.45);
  };

  // Seed perimeter pixels
  for (let x = 0; x < w; x++) {
    const top = x;
    const bot = (h - 1) * w + x;
    if (isBgLike(top)) {
      visited[top] = 1;
      queue[tail++] = top;
    }
    if (!visited[bot] && isBgLike(bot)) {
      visited[bot] = 1;
      queue[tail++] = bot;
    }
  }
  for (let y = 1; y < h - 1; y++) {
    const left = y * w;
    const right = y * w + (w - 1);
    if (!visited[left] && isBgLike(left)) {
      visited[left] = 1;
      queue[tail++] = left;
    }
    if (!visited[right] && isBgLike(right)) {
      visited[right] = 1;
      queue[tail++] = right;
    }
  }

  while (head < tail) {
    const cur = queue[head++];
    data[cur * 4 + 3] = 0;
    const cx = cur % w;
    const cy = Math.floor(cur / w);

    const neighbors = [
      cx > 0 ? cur - 1 : -1,
      cx < w - 1 ? cur + 1 : -1,
      cy > 0 ? cur - w : -1,
      cy < h - 1 ? cur + w : -1,
    ];
    for (const nb of neighbors) {
      if (nb >= 0 && !visited[nb] && isBgLike(nb)) {
        visited[nb] = 1;
        queue[tail++] = nb;
      }
    }
  }

  // Soft 1px alpha feather on foreground boundary adjacent to transparent pixels
  const alphaCopy = new Uint8ClampedArray(w * h);
  for (let p = 0; p < w * h; p++) alphaCopy[p] = data[p * 4 + 3];

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (alphaCopy[p] > 0) {
        let zeroN = 0;
        if (alphaCopy[p - 1] === 0) zeroN++;
        if (alphaCopy[p + 1] === 0) zeroN++;
        if (alphaCopy[p - w] === 0) zeroN++;
        if (alphaCopy[p + w] === 0) zeroN++;
        if (zeroN > 0) {
          data[p * 4 + 3] = Math.round(255 * (1 - zeroN * 0.16));
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

function createMaterialPatternCanvas(mat: MaterialOption): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 160;
  const ctx = c.getContext('2d');
  if (!ctx) return c;

  ctx.fillStyle = mat.swatchHex;
  ctx.fillRect(0, 0, 160, 160);

  if (mat.patternType === 'oak_plank') {
    const plankH = 26;
    for (let y = 0; y < 160; y += plankH) {
      ctx.fillStyle = y % 52 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(60,38,18,0.06)';
      ctx.fillRect(0, y, 160, plankH);
      ctx.strokeStyle = 'rgba(72, 46, 22, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(160, y);
      const jointX = (y * 3 + 40) % 160;
      ctx.moveTo(jointX, y);
      ctx.lineTo(jointX, y + plankH);
      ctx.stroke();
      // wood grain streaks
      ctx.strokeStyle = 'rgba(95, 62, 30, 0.12)';
      for (let g = 4; g < plankH; g += 6) {
        ctx.beginPath();
        ctx.moveTo(0, y + g);
        ctx.bezierCurveTo(50, y + g + 2, 110, y + g - 2, 160, y + g);
        ctx.stroke();
      }
    }
  } else if (mat.patternType === 'herringbone_walnut') {
    ctx.strokeStyle = 'rgba(30, 16, 8, 0.28)';
    ctx.lineWidth = 1.2;
    for (let y = -160; y < 320; y += 22) {
      for (let x = 0; x < 160; x += 40) {
        ctx.fillStyle = ((x + y) / 22) % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 20, y + 20);
        ctx.lineTo(x + 20, y + 42);
        ctx.lineTo(x, y + 22);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x + 20, y + 20);
        ctx.lineTo(x + 40, y);
        ctx.lineTo(x + 40, y + 22);
        ctx.lineTo(x + 20, y + 42);
        ctx.closePath();
        ctx.stroke();
      }
    }
  } else if (mat.patternType === 'microcement' || mat.patternType === 'mineral_plaster') {
    for (let i = 0; i < 420; i++) {
      const rx = (Math.sin(i * 19.7) * 0.5 + 0.5) * 160;
      const ry = (Math.cos(i * 31.3) * 0.5 + 0.5) * 160;
      const rad = 6 + (i % 14);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.045)' : 'rgba(40,35,30,0.045)';
      ctx.beginPath();
      ctx.arc(rx, ry, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (mat.patternType === 'terrazzo') {
    const chips = ['#E8E6E1', '#8A8B8E', '#57585B', '#B89F84'];
    for (let i = 0; i < 160; i++) {
      const rx = (Math.sin(i * 12.9898) * 0.5 + 0.5) * 160;
      const ry = (Math.cos(i * 78.233) * 0.5 + 0.5) * 160;
      ctx.fillStyle = chips[i % chips.length];
      ctx.beginPath();
      ctx.arc(rx, ry, 1.5 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (mat.patternType === 'pet_linen' || mat.patternType === 'boucle') {
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 160; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 160);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(160, i);
      ctx.stroke();
    }
  } else if (mat.patternType === 'sheer_linen' || mat.patternType === 'velvet_blackout') {
    for (let x = 0; x < 160; x += 16) {
      const grad = ctx.createLinearGradient(x, 0, x + 16, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0.12)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.12)');
      grad.addColorStop(1, 'rgba(0,0,0,0.12)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, 16, 160);
    }
  }

  return c;
}

const patternCanvasCache = new Map<string, HTMLCanvasElement>();

function drawMaterialSurfaceMask(
  ctx: CanvasRenderingContext2D,
  poly: Point2D[],
  w: number,
  h: number,
  materialId: string | null,
  blendAlpha = 0.72
) {
  if (!materialId || poly.length < 3) return;
  const mat = getMaterialById(materialId);
  if (!mat) return;

  let patCanvas = patternCanvasCache.get(mat.id);
  if (!patCanvas) {
    patCanvas = createMaterialPatternCanvas(mat);
    patternCanvasCache.set(mat.id, patCanvas);
  }

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(poly[0].x * w, poly[0].y * h);
  for (let i = 1; i < poly.length; i++) {
    ctx.lineTo(poly[i].x * w, poly[i].y * h);
  }
  ctx.closePath();
  ctx.clip();

  const pattern = ctx.createPattern(patCanvas, 'repeat');
  if (pattern) {
    // Base colorize pass preserving underlying shadows
    ctx.globalCompositeOperation = 'color';
    ctx.globalAlpha = Math.min(0.85, blendAlpha);
    ctx.fillStyle = mat.swatchHex;
    ctx.fillRect(0, 0, w, h);

    // Subtle texture & luminosity pass
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = blendAlpha * 0.62;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);

    if (mat.target === 'wall' || mat.target === 'curtain') {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = mat.swatchHex;
      ctx.fillRect(0, 0, w, h);
    }
  }
  ctx.restore();
}

export interface CompositeRenderParams {
  scene: RoomScene;
  styleConfig: StyleConfig;
  materials: MaterialOverrides;
  lighting: LightingConfig;
  furniture: FurnitureItem[];
  calibration: ScaleCalibration;
  showBeforeOriginalOnly?: boolean;
  rearrangeProposalActive?: boolean;
}

export async function renderCompositeRoomCanvas(
  canvas: HTMLCanvasElement,
  params: CompositeRenderParams
): Promise<void> {
  const {
    scene,
    styleConfig,
    materials,
    lighting,
    furniture,
    showBeforeOriginalOnly = false,
    rearrangeProposalActive = false,
  } = params;

  const baseImg = await loadImageCached(scene.imageUrl);
  const w = baseImg.naturalWidth || scene.imageWidth;
  const h = baseImg.naturalHeight || scene.imageHeight;

  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, w, h);

  // If rendering original "Before" image only
  if (showBeforeOriginalOnly) {
    ctx.drawImage(baseImg, 0, 0, w, h);
    return;
  }

  // 1. Base photo
  ctx.drawImage(baseImg, 0, 0, w, h);

  // 2. Style Transfer (Feature 2)
  const styleDef = getStyleById(styleConfig.selectedStyleId);
  const intensity = Math.max(0, Math.min(1, styleConfig.intensity / 100));

  if (styleConfig.applied && intensity > 0) {
    const preRenderUrl = scene.preRenderedStyles?.[styleConfig.selectedStyleId];
    if (preRenderUrl) {
      try {
        const styledImg = await loadImageCached(preRenderUrl);
        ctx.save();
        ctx.globalAlpha = intensity;
        ctx.drawImage(styledImg, 0, 0, w, h);
        ctx.restore();
      } catch {
        // fallback to procedural LUT
      }
    } else {
      // Procedural Style LUT + surface synthesis for any style or custom uploaded photo
      const off = document.createElement('canvas');
      off.width = w;
      off.height = h;
      const octx = off.getContext('2d');
      if (octx) {
        const { brightness, contrast, saturate, sepia, hueRotateDeg, warmTintRgba } =
          styleDef.lutFilter;
        octx.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturate}) sepia(${sepia}) hue-rotate(${hueRotateDeg}deg)`;
        octx.drawImage(baseImg, 0, 0, w, h);
        octx.filter = 'none';

        // Apply style surface defaults gently
        drawMaterialSurfaceMask(octx, scene.surfacePolygons.floor, w, h, styleDef.recommendedFloorId, 0.62);
        drawMaterialSurfaceMask(octx, scene.surfacePolygons.wall, w, h, styleDef.recommendedWallId, 0.42);
        drawMaterialSurfaceMask(octx, scene.surfacePolygons.curtain, w, h, styleDef.recommendedCurtainId, 0.55);

        octx.fillStyle = warmTintRgba;
        octx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.globalAlpha = intensity;
        ctx.drawImage(off, 0, 0, w, h);
        ctx.restore();
      }
    }
  }

  // 3. Explicit Local Material Inpainting overrides (Feature 9)
  drawMaterialSurfaceMask(ctx, scene.surfacePolygons.floor, w, h, materials.floor, 0.78);
  drawMaterialSurfaceMask(ctx, scene.surfacePolygons.wall, w, h, materials.wall, 0.64);
  drawMaterialSurfaceMask(ctx, scene.surfacePolygons.sofa, w, h, materials.sofa, 0.75);
  drawMaterialSurfaceMask(ctx, scene.surfacePolygons.curtain, w, h, materials.curtain, 0.72);

  // 4. Newly Placed Cutout Furniture Items (Feature 3) & Rearranged Layout Indicator (Feature 1)
  if (rearrangeProposalActive) {
    // Draw subtle architectural layout vector trajectories on floor so rearrangement is unmistakably visible on perspective render too
    ctx.save();
    for (const item of furniture) {
      const orig = scene.defaultFurniture.find((d) => d.id === item.id);
      if (!orig) continue;
      const moved =
        Math.abs(orig.topDownPosCm.x - item.topDownPosCm.x) > 15 ||
        Math.abs(orig.topDownPosCm.y - item.topDownPosCm.y) > 15;
      if (moved) {
        // Soft dashed footprint box at old spot + directional arrow to new anchor
        const ox = orig.imagePos.x * w;
        const oy = orig.imagePos.y * h;
        const nx = item.imagePos.x * w;
        const ny = item.imagePos.y * h;

        ctx.strokeStyle = 'rgba(200, 159, 114, 0.85)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([7, 5]);
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.quadraticCurveTo((ox + nx) / 2, Math.min(oy, ny) - 45, nx, ny);
        ctx.stroke();

        // Target ghost furniture block at new perspective coordinate
        ctx.setLineDash([]);
        const boxW = Math.max(84, item.widthCm * 0.78);
        const boxH = Math.max(48, item.heightCm * 0.75);
        ctx.fillStyle = 'rgba(200, 159, 114, 0.22)';
        ctx.strokeStyle = '#DFBA8C';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(nx - boxW / 2, ny - boxH, boxW, boxH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#F8FAFC';
        ctx.font = '600 13px "Noto Sans TC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`新配置：${item.name}`, nx, ny - boxH / 2 + 4);
      }
    }
    ctx.restore();
  }

  for (const item of furniture) {
    if (!item.isOriginal && item.spriteUrl) {
      try {
        const sprite = await loadImageCached(item.spriteUrl);
        // Scale item proportionally using perspective scale & physical height
        const drawH = Math.max(96, Math.min(h * 0.62, item.heightCm * 2.7 * item.imagePos.scale));
        const aspect = sprite.naturalWidth / Math.max(1, sprite.naturalHeight);
        const drawW = drawH * aspect;

        const cx = item.imagePos.x * w;
        const baselineY = item.imagePos.y * h;

        // Cast directional floor contact shadow based on sunPreset
        ctx.save();
        const shadowOffsetX =
          lighting.sunPreset === 'east_morning'
            ? 24
            : lighting.sunPreset === 'west_afternoon'
            ? -22
            : 8;
        const shadowGrad = ctx.createRadialGradient(
          cx + shadowOffsetX * 0.5,
          baselineY - 4,
          drawW * 0.1,
          cx + shadowOffsetX * 0.5,
          baselineY - 4,
          drawW * 0.62
        );
        shadowGrad.addColorStop(0, 'rgba(15, 12, 10, 0.42)');
        shadowGrad.addColorStop(1, 'rgba(15, 12, 10, 0)');
        ctx.fillStyle = shadowGrad;
        ctx.beginPath();
        ctx.ellipse(
          cx + shadowOffsetX * 0.45,
          baselineY - 4,
          drawW * 0.5,
          drawH * 0.11,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();

        // Draw transparent sprite
        ctx.drawImage(sprite, cx - drawW / 2, baselineY - drawH, drawW, drawH);
        ctx.restore();
      } catch {
        // ignore broken sprite
      }
    }
  }

  // 5. Natural Daylight & Artificial Lighting Simulation (Feature 8)
  ctx.save();

  // Sun preset directional lighting
  if (lighting.sunPreset === 'night_mode') {
    ctx.fillStyle = 'rgba(10, 16, 30, 0.46)';
    ctx.fillRect(0, 0, w, h);
  } else if (lighting.sunPreset === 'east_morning') {
    const winX = scene.windowSide === 'left' ? 0 : w;
    const endX = scene.windowSide === 'left' ? w * 0.72 : w * 0.28;
    const beamGrad = ctx.createLinearGradient(winX, h * 0.15, endX, h * 0.95);
    beamGrad.addColorStop(0, 'rgba(255, 245, 218, 0.26)');
    beamGrad.addColorStop(0.55, 'rgba(255, 236, 195, 0.08)');
    beamGrad.addColorStop(1, 'rgba(255, 236, 195, 0)');
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = beamGrad;
    ctx.fillRect(0, 0, w, h);
  } else if (lighting.sunPreset === 'west_afternoon') {
    const winX = scene.windowSide === 'left' ? 0 : w;
    const endX = scene.windowSide === 'left' ? w * 0.85 : w * 0.15;
    const warmGrad = ctx.createLinearGradient(winX, h * 0.2, endX, h * 0.95);
    warmGrad.addColorStop(0, 'rgba(255, 186, 102, 0.34)');
    warmGrad.addColorStop(0.6, 'rgba(245, 158, 72, 0.12)');
    warmGrad.addColorStop(1, 'rgba(245, 158, 72, 0)');
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = warmGrad;
    ctx.fillRect(0, 0, w, h);
  } else if (lighting.sunPreset === 'north_soft') {
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(220, 236, 255, 0.14)';
    ctx.fillRect(0, 0, w, h);
  }

  // Kelvin temperature tint
  const kelvinColor =
    lighting.kelvin === 3000
      ? 'rgba(255, 196, 118, 0.18)'
      : lighting.kelvin === 6000
      ? 'rgba(195, 224, 255, 0.16)'
      : 'rgba(255, 248, 238, 0.05)';
  ctx.globalCompositeOperation = lighting.sunPreset === 'night_mode' ? 'screen' : 'soft-light';
  ctx.fillStyle = kelvinColor;
  ctx.fillRect(0, 0, w, h);

  // Recessed Ceiling Downlights (無主燈嵌燈照明)
  if (lighting.recessedDownlights) {
    ctx.globalCompositeOperation = 'screen';
    const lightTint =
      lighting.kelvin === 3000
        ? 'rgba(255, 208, 138,'
        : lighting.kelvin === 6000
        ? 'rgba(220, 238, 255,'
        : 'rgba(255, 246, 226,';

    const spotPositions = [
      { x: w * 0.38, y: h * 0.08 },
      { x: w * 0.56, y: h * 0.08 },
      { x: w * 0.48, y: h * 0.16 },
    ];
    for (const sp of spotPositions) {
      // Fixture dot
      ctx.fillStyle = `${lightTint} 0.92)`;
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y, 12, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Downward light cone
      const cone = ctx.createRadialGradient(sp.x, sp.y, 8, sp.x, sp.y + h * 0.42, h * 0.46);
      cone.addColorStop(0, `${lightTint} 0.34)`);
      cone.addColorStop(0.5, `${lightTint} 0.10)`);
      cone.addColorStop(1, `${lightTint} 0)`);
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(sp.x - 16, sp.y);
      ctx.lineTo(sp.x + 16, sp.y);
      ctx.lineTo(sp.x + w * 0.17, sp.y + h * 0.55);
      ctx.lineTo(sp.x - w * 0.17, sp.y + h * 0.55);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Indirect Cove Light (間接燈帶)
  if (lighting.indirectCoveLight) {
    ctx.globalCompositeOperation = 'screen';
    const coveColor =
      lighting.kelvin === 3000
        ? 'rgba(255, 198, 112,'
        : lighting.kelvin === 6000
        ? 'rgba(210, 234, 255,'
        : 'rgba(255, 240, 210,';
    const coveGrad = ctx.createLinearGradient(0, h * 0.04, 0, h * 0.25);
    coveGrad.addColorStop(0, `${coveColor} 0.42)`);
    coveGrad.addColorStop(0.45, `${coveColor} 0.16)`);
    coveGrad.addColorStop(1, `${coveColor} 0)`);
    ctx.fillStyle = coveGrad;
    ctx.fillRect(w * 0.25, h * 0.03, w * 0.58, h * 0.24);
  }

  // Ambient brightness balance
  if (lighting.ambientBrightness !== 100) {
    const diff = lighting.ambientBrightness - 100;
    if (diff > 0) {
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.28, diff / 140)})`;
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.globalCompositeOperation = 'multiply';
      const factor = Math.max(0.65, 1 + diff / 120);
      ctx.fillStyle = `rgb(${Math.round(255 * factor)},${Math.round(255 * factor)},${Math.round(255 * factor)})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  ctx.restore();
}
