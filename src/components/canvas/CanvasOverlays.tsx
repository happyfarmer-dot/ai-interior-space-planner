import React, { useEffect, useRef, useState } from 'react';
import { useDesignStore } from '../../store/useDesignStore';
import type { Point2D, ProtectionCategory, SurfaceTarget } from '../../types/design';
import { computePixelPerCm, measureLineCm } from '../../utils/geometry';
import { loadImageCached } from '../../utils/imageProcessing';

const CATEGORY_STYLE: Record<
  ProtectionCategory,
  { stroke: string; fill: string; label: string }
> = {
  window: { stroke: '#38BDF8', fill: 'rgba(56, 189, 248, 0.14)', label: '採光窗面' },
  ac_unit: { stroke: '#2DD4BF', fill: 'rgba(45, 212, 191, 0.16)', label: '冷氣出風' },
  electrical_panel: { stroke: '#EF4444', fill: 'rgba(239, 68, 68, 0.22)', label: '總配電箱' },
  beam_column: { stroke: '#F59E0B', fill: 'rgba(245, 158, 11, 0.15)', label: '結構樑柱' },
  power_outlet: { stroke: '#FB923C', fill: 'rgba(251, 146, 60, 0.2)', label: '電源插座' },
};

const SURFACE_LABELS: Record<SurfaceTarget, string> = {
  floor: '地板材質區',
  wall: '主牆面區域',
  sofa: '沙發織品區',
  curtain: '窗簾布料區',
};

interface LoupeState {
  normX: number;
  normY: number;
  label: string;
}

export const CanvasOverlays: React.FC<{ width: number; height: number }> = ({
  width,
  height,
}) => {
  const {
    state,
    dispatch,
    activeTool,
    setActiveTool,
    activeBrushCategory,
    brushSizePx,
    showProtectionOverlay,
    showErgonomicsOverlay,
    showVisualSearchOverlay,
    visualSearchResults,
    selectedFurnitureId,
    setSelectedFurnitureId,
    ergonomics,
    runPlaceNewObjectWithAi,
    runVisualSearch,
  } = useDesignStore();

  const {
    calibration,
    protectionZones,
    newObject,
    activeMode,
    currentStep,
    materials,
    scene,
    aiRenderedImageUrl,
  } = state.present;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceImgRef = useRef<HTMLImageElement | null>(null);

  const [rulerDrag, setRulerDrag] = useState<{
    start: Point2D;
    end: Point2D;
    draggingEndpoint?: 'start' | 'end' | 'new';
  } | null>(null);
  const [brushStroke, setBrushStroke] = useState<Point2D[] | null>(null);
  const [polyDraft, setPolyDraft] = useState<Point2D[]>([]);
  const [polyDraggingIdx, setPolyDraggingIdx] = useState<number | null>(null);
  const [polyHoverPt, setPolyHoverPt] = useState<Point2D | null>(null);
  const [erasingActive, setErasingActive] = useState(false);
  const [boxSelectDrag, setBoxSelectDrag] = useState<{ start: Point2D; end: Point2D } | null>(null);
  const [loupeState, setLoupeState] = useState<LoupeState | null>(null);

  // Cache current underlying image for Touch Loupe 2.5x magnification
  const activeImgSrc = aiRenderedImageUrl || scene.imageUrl;
  useEffect(() => {
    let cancelled = false;
    if (!activeImgSrc) {
      sourceImgRef.current = null;
      return;
    }
    loadImageCached(activeImgSrc)
      .then((img) => {
        if (!cancelled) sourceImgRef.current = img;
      })
      .catch(() => {
        if (!cancelled) sourceImgRef.current = null;
      });
    return () => {
      cancelled = true;
    };
  }, [activeImgSrc]);

  // Render 2.5x magnified patch + crosshair into Loupe circular canvas
  useEffect(() => {
    const canvas = loupeCanvasRef.current;
    const img = sourceImgRef.current;
    if (!canvas || !loupeState) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const half = size / 2;
    ctx.clearRect(0, 0, size, size);

    ctx.save();
    ctx.beginPath();
    ctx.arc(half, half, half - 2, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = '#0E1013';
    ctx.fillRect(0, 0, size, size);

    if (img) {
      const zoomFactor = 2.5;
      const sampleW = (size / Math.max(1, width)) * img.naturalWidth / zoomFactor;
      const sampleH = (size / Math.max(1, height)) * img.naturalHeight / zoomFactor;
      const srcX = loupeState.normX * img.naturalWidth - sampleW / 2;
      const srcY = loupeState.normY * img.naturalHeight - sampleH / 2;
      ctx.drawImage(img, srcX, srcY, sampleW, sampleH, 0, 0, size, size);
    }

    // Subtle dark vignette border inside circle
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Precision crosshair at center
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(half - 16, half);
    ctx.lineTo(half - 4, half);
    ctx.moveTo(half + 4, half);
    ctx.lineTo(half + 16, half);
    ctx.moveTo(half, half - 16);
    ctx.lineTo(half, half - 4);
    ctx.moveTo(half, half + 4);
    ctx.lineTo(half, half + 16);
    ctx.stroke();

    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(half, half, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }, [loupeState, width, height]);

  const toNormPoint = (clientX: number, clientY: number): Point2D => {
    const svg = svgRef.current;
    if (!svg) return { x: 0.5, y: 0.5 };
    const rect = svg.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width))),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / Math.max(1, rect.height))),
    };
  };

  const eraseZoneAtPoint = (pt: Point2D) => {
    const hitRadiusPx = Math.max(22, brushSizePx * 0.75);
    for (const zone of protectionZones) {
      // Check vertex / stroke distance
      const hitVertex = zone.points.some(
        (p) => Math.hypot((p.x - pt.x) * width, (p.y - pt.y) * height) <= hitRadiusPx
      );
      if (hitVertex) {
        dispatch({ type: 'REMOVE_PROTECTION_ZONE', id: zone.id });
        return;
      }
      // Check bounding box for polygon zones
      if (zone.shape === 'polygon' && zone.points.length >= 3) {
        const xs = zone.points.map((p) => p.x);
        const ys = zone.points.map((p) => p.y);
        if (
          pt.x >= Math.min(...xs) &&
          pt.x <= Math.max(...xs) &&
          pt.y >= Math.min(...ys) &&
          pt.y <= Math.max(...ys)
        ) {
          dispatch({ type: 'REMOVE_PROTECTION_ZONE', id: zone.id });
          return;
        }
      }
    }
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic events without active pointerId
    }
    const pt = toNormPoint(e.clientX, e.clientY);

    if (activeTool === 'ruler') {
      e.stopPropagation();
      // Check if grabbing near existing start or end endpoint
      const distStart = Math.hypot(
        (pt.x - calibration.lineStart.x) * width,
        (pt.y - calibration.lineStart.y) * height
      );
      const distEnd = Math.hypot(
        (pt.x - calibration.lineEnd.x) * width,
        (pt.y - calibration.lineEnd.y) * height
      );
      if (distStart <= 22) {
        setRulerDrag({
          start: pt,
          end: calibration.lineEnd,
          draggingEndpoint: 'start',
        });
      } else if (distEnd <= 22) {
        setRulerDrag({
          start: calibration.lineStart,
          end: pt,
          draggingEndpoint: 'end',
        });
      } else {
        setRulerDrag({ start: pt, end: pt, draggingEndpoint: 'new' });
      }
      setLoupeState({ normX: pt.x, normY: pt.y, label: '2.5x 比例尺端點對位' });
    } else if (activeTool === 'brush_mask') {
      e.stopPropagation();
      setBrushStroke([pt]);
    } else if (activeTool === 'eraser') {
      e.stopPropagation();
      setErasingActive(true);
      eraseZoneAtPoint(pt);
    } else if (activeTool === 'manual_box_select') {
      e.stopPropagation();
      setBoxSelectDrag({ start: pt, end: pt });
    } else if (activeTool === 'polygon_mask') {
      e.stopPropagation();
      setLoupeState({ normX: pt.x, normY: pt.y, label: '2.5x 多邊形頂點對位' });

      // Close polygon if clicking near first vertex (when >= 3 vertices exist)
      if (polyDraft.length >= 3) {
        const first = polyDraft[0];
        const distPx = Math.hypot((pt.x - first.x) * width, (pt.y - first.y) * height);
        if (distPx < 20) {
          const xs = polyDraft.map((p) => p.x);
          const ys = polyDraft.map((p) => p.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);

          dispatch({
            type: 'ADD_PROTECTION_ZONE',
            zone: {
              id: `mep-poly-${Date.now()}`,
              category: activeBrushCategory,
              label: `${CATEGORY_STYLE[activeBrushCategory].label}（多邊形鎖定）`,
              shape: 'polygon',
              points: polyDraft,
              topDownRectCm: {
                x: Math.round(minX * scene.roomDimensionsCm.width),
                y: Math.round(minY * scene.roomDimensionsCm.depth * 0.6),
                w: Math.max(25, Math.round((maxX - minX) * scene.roomDimensionsCm.width)),
                d: Math.max(25, Math.round((maxY - minY) * scene.roomDimensionsCm.depth * 0.4)),
              },
              locked: true,
              autoDetected: false,
            },
          });
          setPolyDraft([]);
          setPolyDraggingIdx(null);
          setPolyHoverPt(null);
          setLoupeState(null);
          return;
        }
      }

      // Check if grabbing an existing vertex to drag-adjust it
      const existingIdx = polyDraft.findIndex(
        (v) => Math.hypot((pt.x - v.x) * width, (pt.y - v.y) * height) < 18
      );
      if (existingIdx >= 0) {
        setPolyDraggingIdx(existingIdx);
        return;
      }

      const nextLen = polyDraft.length;
      setPolyDraft((prev) => [...prev, pt]);
      setPolyDraggingIdx(nextLen);
      setPolyHoverPt(pt);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const pt = toNormPoint(e.clientX, e.clientY);

    if (activeTool === 'ruler' && rulerDrag) {
      e.stopPropagation();
      if (rulerDrag.draggingEndpoint === 'start') {
        setRulerDrag({ ...rulerDrag, start: pt });
      } else {
        setRulerDrag({ ...rulerDrag, end: pt });
      }
      setLoupeState({ normX: pt.x, normY: pt.y, label: '2.5x 比例尺端點對位' });
    } else if (activeTool === 'brush_mask' && brushStroke) {
      e.stopPropagation();
      const last = brushStroke[brushStroke.length - 1];
      if (!last || Math.hypot((pt.x - last.x) * width, (pt.y - last.y) * height) > 6) {
        setBrushStroke([...brushStroke, pt]);
      }
    } else if (activeTool === 'eraser' && erasingActive) {
      e.stopPropagation();
      eraseZoneAtPoint(pt);
    } else if (activeTool === 'manual_box_select' && boxSelectDrag) {
      e.stopPropagation();
      setBoxSelectDrag({ ...boxSelectDrag, end: pt });
    } else if (activeTool === 'polygon_mask') {
      if (polyDraggingIdx !== null) {
        e.stopPropagation();
        setPolyDraft((prev) =>
          prev.map((v, idx) => (idx === polyDraggingIdx ? pt : v))
        );
        setPolyHoverPt(pt);
        setLoupeState({ normX: pt.x, normY: pt.y, label: '2.5x 多邊形頂點對位' });
      } else if (polyDraft.length > 0) {
        setPolyHoverPt(pt);
      }
    }
  };

  const handlePointerUp = () => {
    setLoupeState(null);
    setPolyDraggingIdx(null);
    setErasingActive(false);

    if (activeTool === 'ruler' && rulerDrag) {
      const lenPx = Math.hypot(
        (rulerDrag.end.x - rulerDrag.start.x) * width,
        (rulerDrag.end.y - rulerDrag.start.y) * height
      );
      if (lenPx > 14) {
        const pxPerCm = computePixelPerCm(
          rulerDrag.start,
          rulerDrag.end,
          width,
          height,
          calibration.referenceCm
        );
        dispatch({
          type: 'UPDATE_CALIBRATION',
          patch: {
            calibrated: true,
            lineStart: rulerDrag.start,
            lineEnd: rulerDrag.end,
            pixelPerCm: pxPerCm,
          },
        });
      }
      setRulerDrag(null);
    } else if (activeTool === 'brush_mask' && brushStroke && brushStroke.length > 1) {
      const xs = brushStroke.map((p) => p.x);
      const ys = brushStroke.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      dispatch({
        type: 'ADD_PROTECTION_ZONE',
        zone: {
          id: `mep-brush-${Date.now()}`,
          category: activeBrushCategory,
          label: `${CATEGORY_STYLE[activeBrushCategory].label}（筆刷標記）`,
          shape: 'brush',
          points: brushStroke,
          strokeWidth: brushSizePx / Math.max(1, width),
          topDownRectCm: {
            x: Math.round(minX * scene.roomDimensionsCm.width),
            y: Math.round(minY * scene.roomDimensionsCm.depth * 0.5),
            w: Math.max(28, Math.round((maxX - minX) * scene.roomDimensionsCm.width)),
            d: Math.max(25, Math.round((maxY - minY) * scene.roomDimensionsCm.depth * 0.35)),
          },
          locked: true,
          autoDetected: false,
        },
      });
      setBrushStroke(null);
    } else if (activeTool === 'manual_box_select' && boxSelectDrag) {
      const minX = Math.min(boxSelectDrag.start.x, boxSelectDrag.end.x);
      const maxX = Math.max(boxSelectDrag.start.x, boxSelectDrag.end.x);
      const minY = Math.min(boxSelectDrag.start.y, boxSelectDrag.end.y);
      const maxY = Math.max(boxSelectDrag.start.y, boxSelectDrag.end.y);
      const boxW = (maxX - minX) * width;
      const boxH = (maxY - minY) * height;
      setBoxSelectDrag(null);
      setActiveTool('select');
      if (boxW >= 18 && boxH >= 18) {
        void runVisualSearch({
          cropBoxNorm: {
            x: minX,
            y: minY,
            w: maxX - minX,
            h: maxY - minY,
          },
          forceRefresh: true,
        });
      }
    }
  };

  // Active scale line coordinates
  const activeStart = rulerDrag?.start ?? calibration.lineStart;
  const activeEnd = rulerDrag?.end ?? calibration.lineEnd;
  const liveMeasuredCm = measureLineCm(
    activeStart,
    activeEnd,
    width,
    height,
    calibration.pixelPerCm
  );

  // 3D Perspective Grid rays radiating from vanishing point onto floor
  const vx = calibration.vanishingX * width;
  const hy = calibration.horizonY * height;
  const floorRayXs = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0];
  const depthSteps = [0.68, 0.76, 0.85, 0.94];

  const showMaterialZones =
    activeTool === 'material_pick' || (currentStep === 3 && materials.activeTarget !== null);

  if (!scene.imageUrl) {
    return null;
  }

  const interactiveDrawingTool =
    activeTool === 'ruler' ||
    activeTool === 'brush_mask' ||
    activeTool === 'polygon_mask' ||
    activeTool === 'eraser' ||
    activeTool === 'manual_box_select';

  const loupeSize = 112;
  const loupeLeft = loupeState
    ? Math.max(6, Math.min(width - loupeSize - 6, loupeState.normX * width - loupeSize / 2))
    : 0;
  // Place Touch Loupe ~60px above finger touch center; if too close to top edge, flip below finger
  const rawLoupeTop = loupeState ? loupeState.normY * height - 60 - loupeSize / 2 : 0;
  const loupeTop = loupeState
    ? rawLoupeTop >= 4
      ? rawLoupeTop
      : Math.min(height - loupeSize - 4, loupeState.normY * height + 36)
    : 0;

  return (
    <div className="absolute inset-0 h-full w-full pointer-events-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        style={{ touchAction: interactiveDrawingTool ? 'none' : 'auto' }}
        className={`absolute inset-0 h-full w-full ${
          interactiveDrawingTool ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-auto'
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <defs>
          <pattern id="overlayRedHatch" width="12" height="12" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="12" stroke="rgba(239, 68, 68, 0.55)" strokeWidth="2.5" />
          </pattern>
        </defs>

      {/* 1. Module 5: 3D Perspective Grid */}
      {calibration.showPerspectiveGrid && (
        <g pointerEvents="none" opacity="0.48">
          <line
            x1={0}
            y1={hy}
            x2={width}
            y2={hy}
            stroke="#38BDF8"
            strokeWidth="1"
            strokeDasharray="6 6"
          />
          {floorRayXs.map((rx) => (
            <line
              key={rx}
              x1={vx}
              y1={hy}
              x2={rx * width}
              y2={height}
              stroke="#38BDF8"
              strokeWidth="1"
            />
          ))}
          {depthSteps.map((dy) => (
            <line
              key={dy}
              x1={0}
              y1={dy * height}
              x2={width}
              y2={dy * height}
              stroke="#38BDF8"
              strokeWidth="0.9"
            />
          ))}
        </g>
      )}

      {/* 2. Module 7: Structural & MEP Protection Masks */}
      {showProtectionOverlay &&
        protectionZones.map((zone) => {
          const st = CATEGORY_STYLE[zone.category];
          if (zone.shape === 'brush' && zone.points.length > 1) {
            const pathD = zone.points
              .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * width} ${p.y * height}`)
              .join(' ');
            return (
              <g key={zone.id} opacity={zone.locked ? 0.92 : 0.32} pointerEvents="none">
                <path
                  d={pathD}
                  fill="none"
                  stroke={st.stroke}
                  strokeWidth={(zone.strokeWidth ?? 0.022) * width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.45"
                />
                <path
                  d={pathD}
                  fill="none"
                  stroke={st.stroke}
                  strokeWidth="2"
                  strokeDasharray="5 4"
                />
              </g>
            );
          }

          if (zone.points.length >= 3) {
            const ptsStr = zone.points.map((p) => `${p.x * width},${p.y * height}`).join(' ');
            const labelX = (zone.points[0].x + zone.points[1].x) * 0.5 * width;
            const labelY = zone.points[0].y * height + 16;
            return (
              <g key={zone.id} opacity={zone.locked ? 0.95 : 0.3} pointerEvents="none">
                <polygon
                  points={ptsStr}
                  fill={zone.category === 'electrical_panel' ? 'url(#overlayRedHatch)' : st.fill}
                  stroke={st.stroke}
                  strokeWidth="2"
                  strokeDasharray="6 4"
                />
                <rect
                  x={labelX - 58}
                  y={labelY - 12}
                  width={116}
                  height={20}
                  rx={4}
                  fill="rgba(14, 16, 19, 0.86)"
                  stroke={st.stroke}
                  strokeWidth="1"
                />
                <text
                  x={labelX}
                  y={labelY + 1}
                  fill="#F8FAFC"
                  fontSize="11"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {zone.locked ? '🔒 ' : ''}
                  {st.label}
                </text>
              </g>
            );
          }
          return null;
        })}

      {/* Active Brush Stroke Preview */}
      {brushStroke && brushStroke.length > 1 && (
        <path
          d={brushStroke
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * width} ${p.y * height}`)
            .join(' ')}
          fill="none"
          stroke={CATEGORY_STYLE[activeBrushCategory].stroke}
          strokeWidth={brushSizePx}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.55"
        />
      )}

      {/* Active Polygon Draft Preview */}
      {polyDraft.length > 0 && (
        <g pointerEvents="none">
          <polyline
            points={[...polyDraft, ...(polyHoverPt ? [polyHoverPt] : [])]
              .map((p) => `${p.x * width},${p.y * height}`)
              .join(' ')}
            fill="rgba(239, 68, 68, 0.16)"
            stroke={CATEGORY_STYLE[activeBrushCategory].stroke}
            strokeWidth="2.2"
          />
          {polyDraft.map((p, idx) => (
            <circle
              key={idx}
              cx={p.x * width}
              cy={p.y * height}
              r={idx === 0 ? 7.5 : 5}
              fill={idx === 0 ? '#FDE68A' : CATEGORY_STYLE[activeBrushCategory].stroke}
              stroke="#0E1013"
              strokeWidth="1.5"
            />
          ))}
        </g>
      )}

      {/* Manual Box Select Drag Preview (Feature 11) */}
      {boxSelectDrag && (
        <g pointerEvents="none">
          <rect
            x={Math.min(boxSelectDrag.start.x, boxSelectDrag.end.x) * width}
            y={Math.min(boxSelectDrag.start.y, boxSelectDrag.end.y) * height}
            width={Math.abs(boxSelectDrag.end.x - boxSelectDrag.start.x) * width}
            height={Math.abs(boxSelectDrag.end.y - boxSelectDrag.start.y) * height}
            rx={6}
            fill="rgba(56, 189, 248, 0.18)"
            stroke="#38BDF8"
            strokeWidth="2.4"
            strokeDasharray="6 4"
          />
        </g>
      )}

      {/* 3. Module 5: Scale Calibration Reference Ruler Line */}
      {(currentStep === 1 || activeTool === 'ruler') && (
        <g pointerEvents="none">
          <line
            x1={activeStart.x * width}
            y1={activeStart.y * height}
            x2={activeEnd.x * width}
            y2={activeEnd.y * height}
            stroke="#FBBF24"
            strokeWidth="3"
          />
          <circle cx={activeStart.x * width} cy={activeStart.y * height} r={6} fill="#FBBF24" stroke="#0E1013" strokeWidth="2" />
          <circle cx={activeEnd.x * width} cy={activeEnd.y * height} r={6} fill="#FBBF24" stroke="#0E1013" strokeWidth="2" />
          <g
            transform={`translate(${Math.max(
              92,
              Math.min(width - 92, ((activeStart.x + activeEnd.x) / 2) * width)
            )}, ${Math.max(20, Math.min(height - 20, ((activeStart.y + activeEnd.y) / 2) * height))})`}
          >
            <rect
              x={-88}
              y={-14}
              width={176}
              height={26}
              rx={6}
              fill="rgba(15, 23, 42, 0.94)"
              stroke="#FBBF24"
              strokeWidth="1.5"
            />
            <text
              x={0}
              y={3}
              fill="#FDE68A"
              fontSize="11.5"
              fontWeight="700"
              fontFamily="JetBrains Mono"
              textAnchor="middle"
            >
              {rulerDrag
                ? `量測約 ${liveMeasuredCm} cm`
                : `基準 ${calibration.referenceCm}cm (${calibration.pixelPerCm} px/cm)`}
            </text>
          </g>
        </g>
      )}

      {/* 4. Module 3: New Object Placement Highlight Zones */}
      {activeMode === 'place_object' &&
        newObject.suggestedZones.length > 0 &&
        newObject.suggestedZones.map((zone) => {
          const isSelected = newObject.selectedZoneId === zone.id;
          const ptsStr = zone.footprintPolyNorm
            .map((p) => `${p.x * width},${p.y * height}`)
            .join(' ');
          const cx = zone.imageAnchor.x * width;
          const cy = zone.imageAnchor.y * height;

          return (
            <g
              key={zone.id}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                runPlaceNewObjectWithAi(zone.id);
              }}
            >
              <polygon
                points={ptsStr}
                fill={
                  isSelected
                    ? 'rgba(52, 211, 153, 0.34)'
                    : zone.mepSafe
                    ? 'rgba(200, 159, 114, 0.28)'
                    : 'rgba(245, 158, 11, 0.25)'
                }
                stroke={isSelected ? '#34D399' : zone.mepSafe ? '#E2BE96' : '#F59E0B'}
                strokeWidth={isSelected ? 3 : 2}
                strokeDasharray={isSelected ? undefined : '6 4'}
              />
              <rect
                x={cx - 86}
                y={cy - 34}
                width={172}
                height={26}
                rx={6}
                fill="rgba(14, 16, 19, 0.92)"
                stroke={isSelected ? '#34D399' : '#C89F72'}
                strokeWidth="1.4"
              />
              <text
                x={cx}
                y={cy - 17}
                fill="#F8FAFC"
                fontSize="11.5"
                fontWeight="700"
                textAnchor="middle"
              >
                {isSelected ? '✓ 已擺放：' : '點擊擺放 '}
                {zone.label.split('：')[0]} ({zone.fitScore}分)
              </text>
            </g>
          );
        })}

      {/* 5. Module 9: Clickable Surface Material Hotspots */}
      {showMaterialZones &&
        (['floor', 'wall', 'sofa', 'curtain'] as SurfaceTarget[]).map((target) => {
          const poly = scene.surfacePolygons[target];
          if (!poly || poly.length < 3) return null;
          const isTarget = materials.activeTarget === target;
          const pts = poly.map((p) => `${p.x * width},${p.y * height}`).join(' ');
          const cx = (poly.reduce((acc, p) => acc + p.x, 0) / poly.length) * width;
          const cy = (poly.reduce((acc, p) => acc + p.y, 0) / poly.length) * height;
          return (
            <g
              key={target}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                dispatch({
                  type: 'SET_MATERIAL_OVERRIDE',
                  patch: { activeTarget: target },
                  recordHistory: false,
                });
              }}
            >
              <polygon
                points={pts}
                fill={isTarget ? 'rgba(200, 159, 114, 0.25)' : 'rgba(255, 255, 255, 0.06)'}
                stroke={isTarget ? '#E2BE96' : 'rgba(255,255,255,0.45)'}
                strokeWidth={isTarget ? 2.5 : 1.5}
                strokeDasharray="6 4"
              />
              <rect
                x={cx - 50}
                y={cy - 12}
                width={100}
                height={24}
                rx={12}
                fill="rgba(16, 19, 24, 0.9)"
                stroke={isTarget ? '#E2BE96' : '#475569'}
              />
              <text
                x={cx}
                y={cy + 4}
                fill="#F8FAFC"
                fontSize="11.5"
                fontWeight="600"
                textAnchor="middle"
              >
                {SURFACE_LABELS[target]}
              </text>
            </g>
          );
        })}

      {/* 6. Feature 11: Visual Search Bounding Boxes */}
      {showVisualSearchOverlay &&
        visualSearchResults.map((vs) => {
          const bx = vs.bboxNorm.x * width;
          const by = vs.bboxNorm.y * height;
          const bw = vs.bboxNorm.w * width;
          const bh = vs.bboxNorm.h * height;
          const isSel = selectedFurnitureId === vs.slotId;
          const topMatch = vs.matches[0];
          const labelText = topMatch
            ? `${vs.slotLabel} · ${topMatch.product.brand} NT$${topMatch.product.priceTWD.toLocaleString()}`
            : vs.slotLabel;
          const pillW = Math.min(Math.max(150, labelText.length * 8 + 18), Math.max(180, width - bx - 4));
          return (
            <g
              key={vs.slotId}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedFurnitureId(vs.slotId);
              }}
            >
              <rect
                x={bx}
                y={by}
                width={bw}
                height={bh}
                rx={6}
                fill={isSel ? 'rgba(56, 189, 248, 0.18)' : 'rgba(56, 189, 248, 0.06)'}
                stroke="#38BDF8"
                strokeWidth={isSel ? 2.8 : 1.8}
              />
              <rect
                x={Math.max(4, Math.min(width - pillW - 4, bx))}
                y={Math.max(4, by - 25)}
                width={pillW}
                height={22}
                rx={4}
                fill="rgba(15, 23, 42, 0.95)"
                stroke="#38BDF8"
              />
              <text
                x={Math.max(10, Math.min(width - pillW + 4, bx + 7))}
                y={Math.max(19, by - 10)}
                fill="#E0F2FE"
                fontSize="11"
                fontWeight="600"
              >
                {labelText}
              </text>
            </g>
          );
        })}

      {/* 7. Feature 8: Perspective Ergonomics Summary Pill */}
      {showErgonomicsOverlay && currentStep >= 3 && (
        <g
          pointerEvents="none"
          transform={`translate(10, ${Math.max(8, height - (width < 460 ? 32 : 46))})`}
        >
          <rect
            x={0}
            y={0}
            width={Math.min(width - 20, 340)}
            height={width < 460 ? 24 : 30}
            rx={6}
            fill="rgba(14, 16, 19, 0.88)"
            stroke={
              ergonomics.walkwayStatus === 'green'
                ? '#34D399'
                : ergonomics.walkwayStatus === 'yellow'
                ? '#F59E0B'
                : '#EF4444'
            }
          />
          <circle
            cx={12}
            cy={width < 460 ? 12 : 15}
            r={width < 460 ? 4 : 5}
            fill={
              ergonomics.walkwayStatus === 'green'
                ? '#34D399'
                : ergonomics.walkwayStatus === 'yellow'
                ? '#F59E0B'
                : '#EF4444'
            }
          />
          <text
            x={22}
            y={width < 460 ? 15.5 : 19}
            fill="#F1F5F9"
            fontSize={width < 460 ? '10' : '12'}
            fontWeight="600"
            fontFamily="JetBrains Mono"
          >
            主走道 {ergonomics.mainWalkwayCm}cm · 視聽 {ergonomics.viewingDistanceCm}cm ({ergonomics.recommendedTvInches})
          </text>
        </g>
      )}
      </svg>

      {/* 8. Touch Loupe (偏移放大鏡 2.5x): floats ~60px above finger touch point during ruler/polygon vertex drag */}
      {loupeState && (
        <div
          data-testid="touch-loupe"
          style={{
            left: loupeLeft,
            top: loupeTop,
            width: loupeSize,
            height: loupeSize,
          }}
          className="pointer-events-none absolute z-40 flex flex-col items-center justify-center rounded-full border-2 border-[#FBBF24] bg-[#0E1013] shadow-[0_8px_28px_rgba(0,0,0,0.85)] ring-2 ring-black/60"
        >
          <canvas
            ref={loupeCanvasRef}
            width={loupeSize}
            height={loupeSize}
            className="h-full w-full rounded-full"
          />
          <span className="absolute -bottom-5 whitespace-nowrap rounded bg-[#0E1013]/95 px-1.5 py-0.5 text-[9px] font-bold text-[#FDE68A] border border-[#FBBF24]/50 shadow">
            {loupeState.label}
          </span>
        </div>
      )}
    </div>
  );
};

