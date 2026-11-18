import React, { useRef, useState } from 'react';
import { useDesignStore } from '../../store/useDesignStore';
import type { Point2D, ProtectionCategory, SurfaceTarget } from '../../types/design';
import { computePixelPerCm, measureLineCm } from '../../utils/geometry';

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

export const CanvasOverlays: React.FC<{ width: number; height: number }> = ({
  width,
  height,
}) => {
  const {
    state,
    dispatch,
    activeTool,
    activeBrushCategory,
    brushSizePx,
    showProtectionOverlay,
    showErgonomicsOverlay,
    showVisualSearchOverlay,
    visualSearchResults,
    selectedFurnitureId,
    setSelectedFurnitureId,
    ergonomics,
  } = useDesignStore();

  const {
    calibration,
    protectionZones,
    newObject,
    activeMode,
    currentStep,
    materials,
    scene,
  } = state.present;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [rulerDrag, setRulerDrag] = useState<{ start: Point2D; end: Point2D } | null>(null);
  const [brushStroke, setBrushStroke] = useState<Point2D[] | null>(null);
  const [polyDraft, setPolyDraft] = useState<Point2D[]>([]);

  const toNormPoint = (clientX: number, clientY: number): Point2D => {
    const svg = svgRef.current;
    if (!svg) return { x: 0.5, y: 0.5 };
    const rect = svg.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width))),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / Math.max(1, rect.height))),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (activeTool === 'ruler') {
      e.stopPropagation();
      const pt = toNormPoint(e.clientX, e.clientY);
      setRulerDrag({ start: pt, end: pt });
    } else if (activeTool === 'brush_mask') {
      e.stopPropagation();
      const pt = toNormPoint(e.clientX, e.clientY);
      setBrushStroke([pt]);
    } else if (activeTool === 'polygon_mask') {
      e.stopPropagation();
      const pt = toNormPoint(e.clientX, e.clientY);
      // Close polygon if clicking near first vertex
      if (polyDraft.length >= 3) {
        const first = polyDraft[0];
        const distPx = Math.hypot((pt.x - first.x) * width, (pt.y - first.y) * height);
        if (distPx < 18) {
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
          return;
        }
      }
      setPolyDraft((prev) => [...prev, pt]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (activeTool === 'ruler' && rulerDrag) {
      e.stopPropagation();
      setRulerDrag({ ...rulerDrag, end: toNormPoint(e.clientX, e.clientY) });
    } else if (activeTool === 'brush_mask' && brushStroke) {
      e.stopPropagation();
      const pt = toNormPoint(e.clientX, e.clientY);
      const last = brushStroke[brushStroke.length - 1];
      if (!last || Math.hypot((pt.x - last.x) * width, (pt.y - last.y) * height) > 6) {
        setBrushStroke([...brushStroke, pt]);
      }
    }
  };

  const handlePointerUp = () => {
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

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      className={`absolute inset-0 h-full w-full ${
        activeTool === 'ruler' || activeTool === 'brush_mask' || activeTool === 'polygon_mask'
          ? 'cursor-crosshair pointer-events-auto'
          : 'pointer-events-auto'
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
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
            points={polyDraft.map((p) => `${p.x * width},${p.y * height}`).join(' ')}
            fill="rgba(239, 68, 68, 0.16)"
            stroke={CATEGORY_STYLE[activeBrushCategory].stroke}
            strokeWidth="2.2"
          />
          {polyDraft.map((p, idx) => (
            <circle
              key={idx}
              cx={p.x * width}
              cy={p.y * height}
              r={idx === 0 ? 7 : 4.5}
              fill={idx === 0 ? '#FDE68A' : CATEGORY_STYLE[activeBrushCategory].stroke}
              stroke="#0E1013"
              strokeWidth="1.5"
            />
          ))}
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
                dispatch({ type: 'PLACE_NEW_OBJECT_AT_ZONE', zoneId: zone.id });
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

      {/* 6. Module 10: Visual Search Bounding Boxes */}
      {showVisualSearchOverlay &&
        visualSearchResults.map((vs) => {
          const bx = vs.bboxNorm.x * width;
          const by = vs.bboxNorm.y * height;
          const bw = vs.bboxNorm.w * width;
          const bh = vs.bboxNorm.h * height;
          const isSel = selectedFurnitureId === vs.slotId;
          const topMatch = vs.matches[0];
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
                fill={isSel ? 'rgba(56, 189, 248, 0.16)' : 'rgba(56, 189, 248, 0.05)'}
                stroke="#38BDF8"
                strokeWidth={isSel ? 2.8 : 1.8}
              />
              <rect
                x={bx}
                y={Math.max(6, by - 26)}
                width={Math.min(260, Math.max(150, bw))}
                height={22}
                rx={4}
                fill="rgba(15, 23, 42, 0.94)"
                stroke="#38BDF8"
              />
              <text x={bx + 8} y={Math.max(21, by - 11)} fill="#E0F2FE" fontSize="11" fontWeight="600">
                {topMatch
                  ? `${topMatch.product.brand} · NT$${topMatch.product.priceTWD.toLocaleString()}`
                  : vs.slotLabel}
              </text>
            </g>
          );
        })}

      {/* 7. Module 6: Perspective Ergonomics Summary Pill */}
      {showErgonomicsOverlay && currentStep >= 3 && (
        <g pointerEvents="none" transform={`translate(18, ${height - 46})`}>
          <rect
            x={0}
            y={0}
            width={340}
            height={30}
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
            cx={16}
            cy={15}
            r={5}
            fill={
              ergonomics.walkwayStatus === 'green'
                ? '#34D399'
                : ergonomics.walkwayStatus === 'yellow'
                ? '#F59E0B'
                : '#EF4444'
            }
          />
          <text x={28} y={19} fill="#F1F5F9" fontSize="12" fontWeight="600" fontFamily="JetBrains Mono">
            主走道 {ergonomics.mainWalkwayCm}cm · 視聽 {ergonomics.viewingDistanceCm}cm ({ergonomics.recommendedTvInches})
          </text>
        </g>
      )}
    </svg>
  );
};
