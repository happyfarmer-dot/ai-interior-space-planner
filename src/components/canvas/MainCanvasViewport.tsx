import React, { useEffect, useRef, useState } from 'react';
import {
  Columns2,
  Eye,
  LayoutGrid,
  Loader2,
  Maximize2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useDesignStore } from '../../store/useDesignStore';
import type { CanvasViewMode } from '../../types/design';
import { renderCompositeRoomCanvas } from '../../utils/imageProcessing';
import { BeforeAfterSlider } from './BeforeAfterSlider';
import { CanvasOverlays } from './CanvasOverlays';
import { FloorPlan2DView } from './FloorPlan2DView';

export const MainCanvasViewport: React.FC = () => {
  const {
    state,
    dispatch,
    activeTool,
    zoom,
    setZoom,
    panOffset,
    setPanOffset,
    isAiBusy,
    ergonomics,
  } = useDesignStore();

  const {
    viewMode,
    activeMode,
    scene,
    styleConfig,
    materials,
    lighting,
    furniture,
    calibration,
    protectionZones,
    selectedProposalId,
  } = state.present;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; origX: number; origY: number } | null>(null);

  // Render simulated perspective canvas whenever scene or parameters change
  useEffect(() => {
    if (viewMode !== 'perspective' || !canvasRef.current) return;
    renderCompositeRoomCanvas(canvasRef.current, {
      scene,
      styleConfig,
      materials,
      lighting,
      furniture,
      calibration,
      showBeforeOriginalOnly: false,
      rearrangeProposalActive: activeMode === 'rearrange' && Boolean(selectedProposalId),
    });
  }, [
    viewMode,
    activeMode,
    scene,
    styleConfig,
    materials,
    lighting,
    furniture,
    calibration,
    selectedProposalId,
  ]);

  // Compute responsive display size maintaining aspect ratio
  const aspect = scene.imageWidth / Math.max(1, scene.imageHeight);
  const displayW = 860;
  const displayH = Math.round(displayW / aspect);

  const toolBannerText =
    activeTool === 'ruler'
      ? '比例尺模式：按住滑鼠左鍵在照片已知尺寸處（如門高 210cm）拉出校準線段'
      : activeTool === 'brush_mask'
      ? '筆刷遮罩模式：直接塗抹不可更動區域（窗戶、冷氣、配電箱），AI 將嚴格鎖定保護'
      : activeTool === 'polygon_mask'
      ? '多邊形遮罩模式：依序點擊頂點框選保護區域，點擊起點黃色圓點即可閉合完成'
      : activeTool === 'material_pick'
      ? '局部材質選取：點擊畫面中的地板、主牆面、沙發或窗簾區塊進行材質替換'
      : activeTool === 'pan'
      ? '平移模式：拖曳畫布移動視角，滾動滑鼠滾輪縮放'
      : null;

  const handleViewChange = (mode: CanvasViewMode) => {
    dispatch({ type: 'SET_VIEW_MODE', viewMode: mode });
  };

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden bg-[#0E1013]">
      {/* Top Floating View Switcher & Zoom Toolbar */}
      <div className="z-20 flex flex-wrap items-center justify-between gap-2 border-b border-[#232832] bg-[#14171C]/95 px-4 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-1 rounded-lg border border-[#2A303B] bg-[#1A1E25] p-0.5">
          <button
            type="button"
            onClick={() => handleViewChange('perspective')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
              viewMode === 'perspective'
                ? 'bg-[#C89F72] text-[#111315] shadow-sm'
                : 'text-slate-300 hover:bg-white/5'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            模擬渲染視圖
          </button>
          <button
            type="button"
            onClick={() => handleViewChange('split')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
              viewMode === 'split'
                ? 'bg-[#C89F72] text-[#111315] shadow-sm'
                : 'text-slate-300 hover:bg-white/5'
            }`}
          >
            <Columns2 className="h-3.5 w-3.5" />
            Before / After 對比
          </button>
          <button
            type="button"
            onClick={() => handleViewChange('floorplan')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
              viewMode === 'floorplan'
                ? 'bg-[#C89F72] text-[#111315] shadow-sm'
                : 'text-slate-300 hover:bg-white/5'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            2D 平面配置圖
          </button>
        </div>

        {/* Zoom Controls */}
        {viewMode !== 'floorplan' && (
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))))}
              className="rounded border border-[#2A303B] bg-[#1A1E25] p-1.5 text-slate-300 hover:bg-[#242A33] cursor-pointer"
              title="縮小畫布"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="w-12 text-center font-mono-num text-slate-300">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.6, Number((z + 0.15).toFixed(2))))}
              className="rounded border border-[#2A303B] bg-[#1A1E25] p-1.5 text-slate-300 hover:bg-[#242A33] cursor-pointer"
              title="放大畫布"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setPanOffset({ x: 0, y: 0 });
              }}
              className="flex items-center gap-1 rounded border border-[#2A303B] bg-[#1A1E25] px-2 py-1 text-slate-300 hover:bg-[#242A33] cursor-pointer"
              title="重設縮放與視角"
            >
              <Maximize2 className="h-3 w-3" />
              重設
            </button>
          </div>
        )}
      </div>

      {/* Active Tool Guidance Banner */}
      {toolBannerText && viewMode === 'perspective' && (
        <div className="z-10 flex items-center justify-center border-b border-[#C89F72]/30 bg-[#C89F72]/10 px-4 py-1.5 text-xs text-[#F2D9BB]">
          {toolBannerText}
        </div>
      )}

      {/* Main Interactive Viewport */}
      <div
        className={`relative flex flex-1 items-center justify-center overflow-hidden ${
          activeTool === 'pan' ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : ''
        }`}
        onWheel={(e) => {
          if (viewMode === 'floorplan') return;
          if (e.ctrlKey || Math.abs(e.deltaY) > 0) {
            const delta = e.deltaY > 0 ? -0.08 : 0.08;
            setZoom((z) => Math.max(0.5, Math.min(2.6, Number((z + delta).toFixed(2)))));
          }
        }}
        onPointerDown={(e) => {
          if (viewMode === 'floorplan') return;
          if (activeTool === 'pan' || e.button === 1) {
            setIsPanning(true);
            panStartRef.current = {
              x: e.clientX,
              y: e.clientY,
              origX: panOffset.x,
              origY: panOffset.y,
            };
          }
        }}
        onPointerMove={(e) => {
          if (!isPanning || !panStartRef.current) return;
          setPanOffset({
            x: panStartRef.current.origX + (e.clientX - panStartRef.current.x),
            y: panStartRef.current.origY + (e.clientY - panStartRef.current.y),
          });
        }}
        onPointerUp={() => {
          setIsPanning(false);
          panStartRef.current = null;
        }}
      >
        {viewMode === 'floorplan' ? (
          <FloorPlan2DView />
        ) : (
          <div
            className="relative shadow-2xl ring-1 ring-white/10 transition-transform duration-75 ease-out"
            style={{
              width: displayW,
              height: displayH,
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
            }}
          >
            {viewMode === 'perspective' ? (
              <>
                <canvas
                  ref={canvasRef}
                  className="block h-full w-full rounded bg-black object-contain"
                />
                <CanvasOverlays width={displayW} height={displayH} />
              </>
            ) : (
              <BeforeAfterSlider width={displayW} height={displayH} />
            )}
          </div>
        )}

        {/* AI Processing Indicator Overlay */}
        {isAiBusy && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 backdrop-blur-[2px]">
            <div className="flex items-center gap-3 rounded-xl border border-[#C89F72]/40 bg-[#181B21] px-5 py-3.5 shadow-2xl">
              <Loader2 className="h-5 w-5 animate-spin text-[#C89F72]" />
              <div>
                <p className="text-sm font-semibold text-slate-100">{isAiBusy}</p>
                <p className="text-xs text-slate-400">保留原始透視結構並套用物理空間限制條件</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Spatial Telemetry Status Bar */}
      <footer className="z-20 flex flex-wrap items-center justify-between gap-3 border-t border-[#232832] bg-[#13161B] px-4 py-1.5 text-[11px] text-slate-400">
        <div className="flex flex-wrap items-center gap-4 font-mono-num">
          <span>
            空間：<strong className="text-slate-200">{scene.name}</strong> ({scene.areaPing} 坪)
          </span>
          <span>
            比例尺：
            <strong className={calibration.calibrated ? 'text-emerald-400' : 'text-amber-400'}>
              {calibration.pixelPerCm} px/cm
            </strong>
          </span>
          <span>
            機電保護鎖定：
            <strong className="text-sky-400">
              {protectionZones.filter((z) => z.locked).length} 區
            </strong>
          </span>
          <span>
            走道淨寬：
            <strong
              className={
                ergonomics.walkwayStatus === 'green'
                  ? 'text-emerald-400'
                  : ergonomics.walkwayStatus === 'yellow'
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }
            >
              {ergonomics.mainWalkwayCm} cm
            </strong>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span>色溫 {lighting.kelvin}K</span>
          <span>
            人體工學評分：
            <strong className="font-mono-num text-[#E2BE96]">{ergonomics.overallScore}/100</strong>
          </span>
        </div>
      </footer>
    </main>
  );
};
