import React, { useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { useDesignStore } from '../../store/useDesignStore';
import { getRotatedSizeCm } from '../../utils/geometry';

const STATUS_COLORS = {
  green: '#34D399',
  yellow: '#F59E0B',
  red: '#EF4444',
};

const MEP_FILL: Record<string, { fill: string; stroke: string }> = {
  window: { fill: 'rgba(56, 189, 248, 0.22)', stroke: '#38BDF8' },
  ac_unit: { fill: 'rgba(45, 212, 191, 0.22)', stroke: '#2DD4BF' },
  electrical_panel: { fill: 'rgba(239, 68, 68, 0.28)', stroke: '#EF4444' },
  beam_column: { fill: 'rgba(245, 158, 11, 0.16)', stroke: '#F59E0B' },
  power_outlet: { fill: 'rgba(251, 146, 60, 0.25)', stroke: '#FB923C' },
};

export const FloorPlan2DView: React.FC = () => {
  const {
    state,
    dispatch,
    ergonomics,
    selectedFurnitureId,
    setSelectedFurnitureId,
    showProtectionOverlay,
    showErgonomicsOverlay,
  } = useDesignStore();

  const { scene, furniture, protectionZones } = state.present;
  const { width: roomW, depth: roomD } = scene.roomDimensionsCm;
  const padding = 52;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragState, setDragState] = useState<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const clientToCm = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const totalW = roomW + padding * 2;
    const totalH = roomD + padding * 2;
    const scale = Math.min(rect.width / totalW, rect.height / totalH);
    const renderedW = totalW * scale;
    const renderedH = totalH * scale;
    const leftPad = (rect.width - renderedW) / 2;
    const topPad = (rect.height - renderedH) / 2;

    return {
      x: (clientX - rect.left - leftPad) / scale - padding,
      y: (clientY - rect.top - topPad) / scale - padding,
    };
  };

  // Compute SVG arc path for door swing
  const { hingeCm, radiusCm, startAngleDeg, endAngleDeg } = scene.doorSwing;
  const rad1 = (startAngleDeg * Math.PI) / 180;
  const rad2 = (endAngleDeg * Math.PI) / 180;
  const arcX1 = hingeCm.x + radiusCm * Math.cos(rad1);
  const arcY1 = hingeCm.y + radiusCm * Math.sin(rad1);
  const arcX2 = hingeCm.x + radiusCm * Math.cos(rad2);
  const arcY2 = hingeCm.y + radiusCm * Math.sin(rad2);

  // TV axis line points
  const sofa = furniture.find((f) => f.category === 'sofa') ?? furniture.find((f) => f.category === 'bed');
  const tvConsole = furniture.find((f) => f.category === 'tv_console');
  let tvAxis: { x1: number; y1: number; x2: number; y2: number } | null = null;
  if (sofa) {
    const sr = getRotatedSizeCm(sofa);
    const x1 = sofa.topDownPosCm.x + sr.w / 2;
    const y1 = sofa.topDownPosCm.y + sr.d / 2;
    const tr = tvConsole ? getRotatedSizeCm(tvConsole) : null;
    const x2 = tvConsole && tr ? tvConsole.topDownPosCm.x + tr.w / 2 : scene.tvWallCenterCm.x;
    const y2 = tvConsole && tr ? tvConsole.topDownPosCm.y + tr.d / 2 : scene.tvWallCenterCm.y;
    tvAxis = { x1, y1, x2, y2 };
  }

  const selectedItem = furniture.find((f) => f.id === selectedFurnitureId);

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center bg-[#101318] p-2 sm:p-4 select-none">
      {/* Top 2D CAD Action Hint */}
      <div className="mb-1.5 sm:mb-2 flex w-full max-w-4xl flex-wrap items-center justify-between gap-1.5 text-[10px] sm:text-xs text-slate-400">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="rounded bg-[#1D222B] px-2 py-0.5 font-mono-num text-[#DFBA8C] border border-[#2D3442]">
            2D 平面（1:{Math.round(roomW / 10)}）
          </span>
          <span className="hidden sm:inline">拖曳家具方塊即可即時重新檢測走道淨寬與門片干涉</span>
        </div>
        {selectedItem && (
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: 'MOVE_FURNITURE_2D',
                id: selectedItem.id,
                x: selectedItem.topDownPosCm.x,
                y: selectedItem.topDownPosCm.y,
                rotationDeg: (selectedItem.topDownPosCm.rotationDeg + 90) % 360,
              })
            }
            className="flex items-center gap-1 rounded bg-[#C89F72]/15 px-2 py-0.5 sm:py-1 text-[10.5px] sm:text-xs font-medium text-[#E2BE96] border border-[#C89F72]/40 hover:bg-[#C89F72]/25 transition cursor-pointer"
          >
            <RotateCw className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            旋轉「{selectedItem.name}」90°
          </button>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox={`${-padding} ${-padding} ${roomW + padding * 2} ${roomD + padding * 2}`}
        style={{ touchAction: 'none' }}
        className="min-h-0 flex-1 w-full max-w-4xl lg:max-h-[600px] rounded-lg border border-[#272D38] bg-[#14181F] shadow-inner"
        onPointerMove={(e) => {
          if (!dragState) return;
          const pt = clientToCm(e.clientX, e.clientY);
          dispatch({
            type: 'MOVE_FURNITURE_2D',
            id: dragState.id,
            x: Math.round(pt.x - dragState.offsetX),
            y: Math.round(pt.y - dragState.offsetY),
          });
        }}
        onPointerUp={() => setDragState(null)}
        onPointerLeave={() => setDragState(null)}
      >
        <defs>
          <pattern id="cadGrid50" width="50" height="50" patternUnits="userSpaceOnUse">
            <path
              d="M 50 0 L 0 0 0 50"
              fill="none"
              stroke="rgba(148, 163, 184, 0.08)"
              strokeWidth="1"
            />
          </pattern>
          <pattern id="mepHatch" width="12" height="12" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="12" stroke="rgba(239, 68, 68, 0.45)" strokeWidth="2" />
          </pattern>
        </defs>

        {/* CAD 50cm Grid inside Room */}
        <rect x={0} y={0} width={roomW} height={roomD} fill="url(#cadGrid50)" />

        {/* Outer Dimensions Callouts */}
        <g stroke="#475569" strokeWidth="1" fill="#94A3B8" fontSize="11" fontFamily="JetBrains Mono">
          <line x1={0} y1={-20} x2={roomW} y2={-20} />
          <line x1={0} y1={-26} x2={0} y2={-14} />
          <line x1={roomW} y1={-26} x2={roomW} y2={-14} />
          <text x={roomW / 2} y={-26} textAnchor="middle">
            {roomW} cm
          </text>

          <line x1={-22} y1={0} x2={-22} y2={roomD} />
          <line x1={-28} y1={0} x2={-16} y2={0} />
          <line x1={-28} y1={roomD} x2={-16} y2={roomD} />
          <text
            x={-30}
            y={roomD / 2}
            textAnchor="middle"
            transform={`rotate(-90, -30, ${roomD / 2})`}
          >
            {roomD} cm
          </text>
        </g>

        {/* Room Perimeter Walls */}
        <rect
          x={0}
          y={0}
          width={roomW}
          height={roomD}
          fill="none"
          stroke="#CBD5E1"
          strokeWidth="6"
        />

        {/* Door Swing Arc */}
        <g>
          <path
            d={`M ${hingeCm.x} ${hingeCm.y} L ${arcX1} ${arcY1} A ${radiusCm} ${radiusCm} 0 0 1 ${arcX2} ${arcY2} Z`}
            fill={ergonomics.doorSwingClear ? 'rgba(52, 211, 153, 0.12)' : 'rgba(239, 68, 68, 0.25)'}
            stroke={ergonomics.doorSwingClear ? '#34D399' : '#EF4444'}
            strokeWidth="1.8"
            strokeDasharray="5 4"
          />
          <line
            x1={hingeCm.x}
            y1={hingeCm.y}
            x2={arcX1}
            y2={arcY1}
            stroke="#E2E8F0"
            strokeWidth="4"
          />
          <text
            x={hingeCm.x + (hingeCm.x > roomW / 2 ? -radiusCm * 0.55 : radiusCm * 0.55)}
            y={hingeCm.y - radiusCm * 0.45}
            fill={ergonomics.doorSwingClear ? '#6EE7B7' : '#FCA5A5'}
            fontSize="10"
            textAnchor="middle"
          >
            門片半徑 {radiusCm}cm
          </text>
        </g>

        {/* Protected MEP & Structural Zones */}
        {showProtectionOverlay &&
          protectionZones
            .filter((z) => z.locked)
            .map((zone) => {
              const colors = MEP_FILL[zone.category] || MEP_FILL.beam_column;
              const r = zone.topDownRectCm;
              return (
                <g key={zone.id}>
                  <rect
                    x={r.x}
                    y={r.y}
                    width={r.w}
                    height={r.d}
                    fill={zone.category === 'electrical_panel' ? 'url(#mepHatch)' : colors.fill}
                    stroke={colors.stroke}
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                  />
                  <text
                    x={r.x + r.w / 2}
                    y={r.y + r.d / 2 + 3}
                    fill={colors.stroke}
                    fontSize="9.5"
                    fontWeight="600"
                    textAnchor="middle"
                  >
                    {zone.label.split('（')[0]}
                  </text>
                </g>
              );
            })}

        {/* Furniture Footprints */}
        {furniture.map((item) => {
          const { w, d } = getRotatedSizeCm(item);
          const isSelected = selectedFurnitureId === item.id;
          const x = item.topDownPosCm.x;
          const y = item.topDownPosCm.y;
          return (
            <g
              key={item.id}
              className="cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => {
                e.stopPropagation();
                setSelectedFurnitureId(item.id);
                const pt = clientToCm(e.clientX, e.clientY);
                setDragState({
                  id: item.id,
                  offsetX: pt.x - x,
                  offsetY: pt.y - y,
                });
              }}
            >
              <rect
                x={x}
                y={y}
                width={w}
                height={d}
                rx={4}
                fill={
                  item.isOriginal
                    ? 'rgba(200, 159, 114, 0.22)'
                    : 'rgba(56, 189, 248, 0.26)'
                }
                stroke={isSelected ? '#FDE68A' : item.isOriginal ? '#C89F72' : '#38BDF8'}
                strokeWidth={isSelected ? 3 : 1.8}
              />
              {/* Orientation front indicator bar */}
              <line
                x1={x + 6}
                y1={y + 6}
                x2={x + w - 6}
                y2={y + 6}
                stroke={item.isOriginal ? '#E2BE96' : '#7DD3FC'}
                strokeWidth="2"
                opacity="0.7"
              />
              <text
                x={x + w / 2}
                y={y + d / 2 - 2}
                fill="#F8FAFC"
                fontSize="10.5"
                fontWeight="600"
                textAnchor="middle"
              >
                {item.name.slice(0, 10)}
              </text>
              <text
                x={x + w / 2}
                y={y + d / 2 + 11}
                fill="#94A3B8"
                fontSize="9"
                fontFamily="JetBrains Mono"
                textAnchor="middle"
              >
                {w}×{d}cm
              </text>
            </g>
          );
        })}

        {/* Ergonomics Overlays: Main Walkway Clearance & Viewing Distance */}
        {showErgonomicsOverlay && (
          <g pointerEvents="none">
            {/* Walkway Clearance */}
            <line
              x1={ergonomics.walkwaySegmentCm[0].x}
              y1={ergonomics.walkwaySegmentCm[0].y}
              x2={ergonomics.walkwaySegmentCm[1].x}
              y2={ergonomics.walkwaySegmentCm[1].y}
              stroke={STATUS_COLORS[ergonomics.walkwayStatus]}
              strokeWidth="2.5"
              strokeDasharray="5 3"
            />
            <circle
              cx={ergonomics.walkwaySegmentCm[0].x}
              cy={ergonomics.walkwaySegmentCm[0].y}
              r={4}
              fill={STATUS_COLORS[ergonomics.walkwayStatus]}
            />
            <circle
              cx={ergonomics.walkwaySegmentCm[1].x}
              cy={ergonomics.walkwaySegmentCm[1].y}
              r={4}
              fill={STATUS_COLORS[ergonomics.walkwayStatus]}
            />
                <g
                  transform={`translate(${
                    (ergonomics.walkwaySegmentCm[0].x + ergonomics.walkwaySegmentCm[1].x) / 2
                  }, ${(ergonomics.walkwaySegmentCm[0].y + ergonomics.walkwaySegmentCm[1].y) / 2 - 22})`}
                >
                  <rect
                    x={-48}
                    y={-10}
                    width={96}
                    height={18}
                    rx={4}
                    fill="#0F172A"
                    stroke={STATUS_COLORS[ergonomics.walkwayStatus]}
                    strokeWidth="1.2"
                  />
                  <text
                    x={0}
                    y={0}
                    fill={STATUS_COLORS[ergonomics.walkwayStatus]}
                    fontSize="9.5"
                    fontWeight="700"
                    fontFamily="JetBrains Mono"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    走道 {ergonomics.mainWalkwayCm}cm
                  </text>
                </g>

            {/* Viewing Distance Axis */}
            {tvAxis && (
              <g>
                <line
                  x1={tvAxis.x1}
                  y1={tvAxis.y1}
                  x2={tvAxis.x2}
                  y2={tvAxis.y2}
                  stroke="#38BDF8"
                  strokeWidth="1.5"
                  strokeDasharray="3 4"
                  opacity="0.7"
                />
                <rect
                  x={(tvAxis.x1 + tvAxis.x2) / 2 - 58}
                  y={(tvAxis.y1 + tvAxis.y2) / 2 + 22}
                  width={116}
                  height={17}
                  rx={4}
                  fill="rgba(15, 23, 42, 0.94)"
                  stroke="rgba(56, 189, 248, 0.65)"
                />
                <text
                  x={(tvAxis.x1 + tvAxis.x2) / 2}
                  y={(tvAxis.y1 + tvAxis.y2) / 2 + 33}
                  fill="#7DD3FC"
                  fontSize="9"
                  fontFamily="JetBrains Mono"
                  textAnchor="middle"
                >
                  視距 {ergonomics.viewingDistanceCm}cm ({ergonomics.recommendedTvInches})
                </text>
              </g>
            )}
          </g>
        )}
      </svg>
    </div>
  );
};
