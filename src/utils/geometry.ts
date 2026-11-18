import type { DoorSwingSpec, FurnitureItem, Point2D, TopDownRectCm } from '../types/design';

export function getRotatedSizeCm(item: Pick<FurnitureItem, 'widthCm' | 'depthCm' | 'topDownPosCm'>): {
  w: number;
  d: number;
} {
  const rot = Math.abs(item.topDownPosCm.rotationDeg) % 180;
  if (rot === 90) {
    return { w: item.depthCm, d: item.widthCm };
  }
  return { w: item.widthCm, d: item.depthCm };
}

export function getItemFootprintRect(item: FurnitureItem): TopDownRectCm {
  const { w, d } = getRotatedSizeCm(item);
  return {
    x: item.topDownPosCm.x,
    y: item.topDownPosCm.y,
    w,
    d,
  };
}

export function rectsOverlap(a: TopDownRectCm, b: TopDownRectCm, margin = 0): boolean {
  return (
    a.x < b.x + b.w + margin &&
    a.x + a.w + margin > b.x &&
    a.y < b.y + b.d + margin &&
    a.y + a.d + margin > b.y
  );
}

export function rectGapCm(a: TopDownRectCm, b: TopDownRectCm): {
  distance: number;
  segA: Point2D;
  segB: Point2D;
} {
  const aRight = a.x + a.w;
  const aBottom = a.y + a.d;
  const bRight = b.x + b.w;
  const bBottom = b.y + b.d;

  let dx = 0;
  let ax = a.x + a.w / 2;
  let bx = b.x + b.w / 2;
  if (aRight < b.x) {
    dx = b.x - aRight;
    ax = aRight;
    bx = b.x;
  } else if (bRight < a.x) {
    dx = a.x - bRight;
    ax = a.x;
    bx = bRight;
  } else {
    const overlapLeft = Math.max(a.x, b.x);
    const overlapRight = Math.min(aRight, bRight);
    ax = (overlapLeft + overlapRight) / 2;
    bx = ax;
  }

  let dy = 0;
  let ay = a.y + a.d / 2;
  let by = b.y + b.d / 2;
  if (aBottom < b.y) {
    dy = b.y - aBottom;
    ay = aBottom;
    by = b.y;
  } else if (bBottom < a.y) {
    dy = a.y - bBottom;
    ay = a.y;
    by = bBottom;
  } else {
    const overlapTop = Math.max(a.y, b.y);
    const overlapBottom = Math.min(aBottom, bBottom);
    ay = (overlapTop + overlapBottom) / 2;
    by = ay;
  }

  return {
    distance: Math.round(Math.hypot(dx, dy)),
    segA: { x: ax, y: ay },
    segB: { x: bx, y: by },
  };
}

export function doesRectIntersectDoorSwing(
  rect: TopDownRectCm,
  door: DoorSwingSpec
): boolean {
  // Sample points inside and on perimeter of rect to check if inside door swing circle & angle sector
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      const px = rect.x + (rect.w * i) / steps;
      const py = rect.y + (rect.d * j) / steps;
      const dx = px - door.hingeCm.x;
      const dy = py - door.hingeCm.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= door.radiusCm - 4) {
        let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (deg < 0) deg += 360;
        const start = ((door.startAngleDeg % 360) + 360) % 360;
        const end = ((door.endAngleDeg % 360) + 360) % 360;
        if (start <= end) {
          if (deg >= start && deg <= end) return true;
        } else {
          if (deg >= start || deg <= end) return true;
        }
      }
    }
  }
  return false;
}

export function computePixelPerCm(
  lineStart: Point2D,
  lineEnd: Point2D,
  imageWidth: number,
  imageHeight: number,
  referenceCm: number
): number {
  if (referenceCm <= 0) return 3.0;
  const dx = (lineEnd.x - lineStart.x) * imageWidth;
  const dy = (lineEnd.y - lineStart.y) * imageHeight;
  const pixelLen = Math.hypot(dx, dy);
  return Number(Math.max(0.2, pixelLen / referenceCm).toFixed(2));
}

export function measureLineCm(
  lineStart: Point2D,
  lineEnd: Point2D,
  imageWidth: number,
  imageHeight: number,
  pixelPerCm: number
): number {
  const dx = (lineEnd.x - lineStart.x) * imageWidth;
  const dy = (lineEnd.y - lineStart.y) * imageHeight;
  const px = Math.hypot(dx, dy);
  return Math.round(px / Math.max(0.2, pixelPerCm));
}
