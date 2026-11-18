import React, { useEffect, useRef, useState } from 'react';
import { MoveHorizontal } from 'lucide-react';
import { useDesignStore } from '../../store/useDesignStore';
import { renderCompositeRoomCanvas } from '../../utils/imageProcessing';

export const BeforeAfterSlider: React.FC<{ width: number; height: number }> = ({
  width,
  height,
}) => {
  const { state } = useDesignStore();
  const {
    activeMode,
    scene,
    styleConfig,
    materials,
    lighting,
    furniture,
    calibration,
    selectedProposalId,
  } = state.present;

  const beforeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const afterCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [splitPercent, setSplitPercent] = useState<number>(52);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (beforeCanvasRef.current) {
      renderCompositeRoomCanvas(beforeCanvasRef.current, {
        scene,
        styleConfig,
        materials,
        lighting,
        furniture,
        calibration,
        showBeforeOriginalOnly: true,
      });
    }
    if (afterCanvasRef.current) {
      renderCompositeRoomCanvas(afterCanvasRef.current, {
        scene,
        styleConfig,
        materials,
        lighting,
        furniture,
        calibration,
        showBeforeOriginalOnly: false,
        rearrangeProposalActive: activeMode === 'rearrange' && Boolean(selectedProposalId),
      });
    }
  }, [activeMode, scene, styleConfig, materials, lighting, furniture, calibration, selectedProposalId]);

  const updateSplit = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / Math.max(1, rect.width)) * 100;
    setSplitPercent(Math.max(4, Math.min(96, pct)));
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full select-none overflow-hidden"
      style={{ width, height }}
      onPointerMove={(e) => {
        if (dragging) {
          e.stopPropagation();
          updateSplit(e.clientX);
        }
      }}
      onPointerUp={() => setDragging(false)}
      onPointerLeave={() => setDragging(false)}
    >
      {/* After (Simulated) Canvas Base */}
      <canvas ref={afterCanvasRef} className="block h-full w-full object-contain" />

      {/* Before (Original) Canvas Clipped */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - splitPercent}% 0 0)` }}
      >
        <canvas ref={beforeCanvasRef} className="block h-full w-full object-contain" />
      </div>

      {/* Labels */}
      <span className="pointer-events-none absolute left-3 top-3 rounded bg-black/75 px-2.5 py-1 text-xs font-medium text-slate-200 border border-white/15 backdrop-blur-sm">
        原始現況 BEFORE
      </span>
      <span className="pointer-events-none absolute right-3 top-3 rounded bg-[#C89F72]/90 px-2.5 py-1 text-xs font-semibold text-[#111315] shadow">
        模擬改造 AFTER ({styleConfig.applied ? `${styleConfig.intensity}% 風格` : '即時渲染'})
      </span>

      {/* Interactive Split Divider */}
      <div
        role="slider"
        aria-label="前後對比滑桿"
        aria-valuemin={4}
        aria-valuemax={96}
        aria-valuenow={Math.round(splitPercent)}
        tabIndex={0}
        onPointerDown={(e) => {
          e.stopPropagation();
          setDragging(true);
          updateSplit(e.clientX);
        }}
        className="absolute inset-y-0 z-20 flex w-6 -translate-x-1/2 cursor-ew-resize items-center justify-center"
        style={{ left: `${splitPercent}%` }}
      >
        <div className="h-full w-0.5 bg-[#E2BE96] shadow-[0_0_8px_rgba(0,0,0,0.75)]" />
        <div className="absolute flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#E2BE96] bg-[#16191E] text-[#E2BE96] shadow-lg transition hover:scale-110">
          <MoveHorizontal className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
};
