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
    aiRenderedImageUrl,
    aiRenderMode,
  } = state.present;

  const beforeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const afterCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [splitPercent, setSplitPercent] = useState<number>(52);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!scene.imageUrl) return;
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
        aiRenderedImageUrl,
        aiRenderMode,
      });
    }
  }, [
    activeMode,
    scene,
    styleConfig,
    materials,
    lighting,
    furniture,
    calibration,
    selectedProposalId,
    aiRenderedImageUrl,
    aiRenderMode,
  ]);

  const updateSplit = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / Math.max(1, rect.width)) * 100;
    setSplitPercent(Math.max(4, Math.min(96, pct)));
  };

  if (!scene.imageUrl) {
    return (
      <div
        className="flex items-center justify-center rounded border border-dashed border-[#2F3643] bg-[#13171D] p-4 text-center text-xs text-slate-400"
        style={{ width, height }}
      >
        請先於「功能 1」拍攝或上傳室內現況照片後即可進行前後滑動對比
      </div>
    );
  }

  const compact = width < 480;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full select-none overflow-hidden"
      style={{ width, height, touchAction: 'none' }}
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
      <span
        className={`pointer-events-none absolute left-2 top-2 rounded bg-black/75 border border-white/15 backdrop-blur-sm font-medium text-slate-200 ${
          compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
        }`}
      >
        {compact ? '原況 BEFORE' : '原始現況 BEFORE'}
      </span>
      <span
        className={`pointer-events-none absolute right-2 top-2 rounded bg-[#C89F72]/90 font-semibold text-[#111315] shadow ${
          compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
        }`}
      >
        {compact
          ? aiRenderedImageUrl
            ? 'Gemini 改造'
            : '改造 AFTER'
          : aiRenderedImageUrl
          ? `Gemini AI 模擬 AFTER (${
              aiRenderMode === 'rearrange'
                ? '家具重排實景'
                : aiRenderMode === 'place_object'
                ? '單品實景合成'
                : aiRenderMode === 'refine'
                ? '光影/材質重繪'
                : `${styleConfig.intensity}% 風格`
            })`
          : `即時渲染 AFTER (${styleConfig.applied ? `${styleConfig.intensity}% 風格` : '待生成 AI 圖'})`}
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
        className="absolute inset-y-0 z-20 flex w-7 -translate-x-1/2 cursor-ew-resize items-center justify-center"
        style={{ left: `${splitPercent}%`, touchAction: 'none' }}
      >
        <div className="h-full w-0.5 bg-[#E2BE96] shadow-[0_0_8px_rgba(0,0,0,0.75)]" />
        <div className="absolute flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border-2 border-[#E2BE96] bg-[#16191E] text-[#E2BE96] shadow-lg transition hover:scale-110">
          <MoveHorizontal className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
};
