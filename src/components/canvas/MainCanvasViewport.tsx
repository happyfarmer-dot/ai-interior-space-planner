import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Columns2,
  Eye,
  LayoutGrid,
  Loader2,
  Maximize2,
  MessageSquarePlus,
  Send,
  Upload,
  XCircle,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useDesignStore } from '../../store/useDesignStore';
import type { CanvasViewMode } from '../../types/design';
import { renderCompositeRoomCanvas } from '../../utils/imageProcessing';
import { isNativeApp } from '../../utils/nativePlatform';
import { BeforeAfterSlider } from './BeforeAfterSlider';
import { CanvasOverlays } from './CanvasOverlays';
import { CanvasToolbar } from './CanvasToolbar';
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
    cancelAiGeneration,
    ergonomics,
    handleUploadCustomRoom,
    pickRoomPhotoNative,
    conversationalHistory,
    runConversationalEdit,
  } = useDesignStore();

  const {
    viewMode,
    activeMode,
    currentStep,
    scene,
    styleConfig,
    materials,
    lighting,
    furniture,
    calibration,
    protectionZones,
    selectedProposalId,
    aiRenderedImageUrl,
    aiRenderMode,
    aiRenderDescription,
  } = state.present;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [mobileCollapsed, setMobileCollapsed] = useState(false);
  const [chatPrompt, setChatPrompt] = useState('');
  const [stageSize, setStageSize] = useState<{ width: number; height: number }>({
    width: 880,
    height: 520,
  });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; origX: number; origY: number } | null>(null);

  // Track responsive container dimensions via ResizeObserver
  useEffect(() => {
    const el = stageContainerRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setStageSize({
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    };

    measure();
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    return () => observer.disconnect();
  }, [mobileCollapsed, viewMode]);

  // Render simulated perspective canvas whenever scene or parameters change
  useEffect(() => {
    if (viewMode !== 'perspective' || !canvasRef.current || !scene.imageUrl) return;
    renderCompositeRoomCanvas(canvasRef.current, {
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
    aiRenderedImageUrl,
    aiRenderMode,
    mobileCollapsed,
  ]);

  // Compute responsive display size maintaining aspect ratio within stage boundaries
  const aspect = scene.imageWidth / Math.max(1, scene.imageHeight);
  const availW = Math.max(200, stageSize.width - 16);
  const availH = Math.max(130, stageSize.height - 12);
  let fitW = Math.min(920, availW);
  let fitH = fitW / aspect;
  if (fitH > availH) {
    fitH = availH;
    fitW = fitH * aspect;
  }
  const displayW = Math.max(180, Math.round(fitW));
  const displayH = Math.max(110, Math.round(fitH));

  const handleViewChange = (mode: CanvasViewMode) => {
    dispatch({ type: 'SET_VIEW_MODE', viewMode: mode });
  };

  const hasPhoto = Boolean(scene.imageUrl);
  const showConversationalBar = currentStep === 3 && hasPhoto && !mobileCollapsed;

  const handleSendConversationalEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatPrompt.trim();
    if (!trimmed || isAiBusy) return;
    setChatPrompt('');
    await runConversationalEdit(trimmed);
  };

  return (
    <main
      className={`order-1 lg:order-2 sticky top-0 z-20 lg:static lg:z-auto flex w-full min-w-0 flex-col border-b border-[#232832] bg-[#0E1013] lg:flex-1 lg:border-b-0 lg:overflow-hidden transition-all duration-200 ${
        mobileCollapsed
          ? 'h-auto lg:h-full'
          : 'h-[44vh] min-h-[295px] max-h-[460px] lg:h-full lg:min-h-0 lg:max-h-none'
      }`}
    >
      {/* Hidden quick inputs for empty canvas upload buttons */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUploadCustomRoom(file);
          e.target.value = '';
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUploadCustomRoom(file);
          e.target.value = '';
        }}
      />

      {/* Top Sticky View Switcher & Expand/Collapse Header */}
      <div className="z-20 flex shrink-0 items-center justify-between gap-1 sm:gap-1.5 border-b border-[#232832] bg-[#14171C]/95 px-2 sm:px-4 py-1.5 sm:py-2 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-0.5 sm:gap-1 rounded-lg border border-[#2A303B] bg-[#1A1E25] p-0.5">
          <button
            type="button"
            onClick={() => handleViewChange('perspective')}
            className={`flex items-center gap-1 rounded-md px-1.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-medium transition cursor-pointer ${
              viewMode === 'perspective'
                ? 'bg-[#C89F72] text-[#111315] shadow-sm font-bold'
                : 'text-slate-300 hover:bg-white/5'
            }`}
          >
            <Eye className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span className="sm:hidden">模擬圖</span>
            <span className="hidden sm:inline">模擬渲染視圖</span>
          </button>
          <button
            type="button"
            onClick={() => handleViewChange('split')}
            className={`flex items-center gap-1 rounded-md px-1.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-medium transition cursor-pointer ${
              viewMode === 'split'
                ? 'bg-[#C89F72] text-[#111315] shadow-sm font-bold'
                : 'text-slate-300 hover:bg-white/5'
            }`}
          >
            <Columns2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span className="sm:hidden">前後對比</span>
            <span className="hidden sm:inline">Before / After 對比</span>
          </button>
          <button
            type="button"
            onClick={() => handleViewChange('floorplan')}
            className={`flex items-center gap-1 rounded-md px-1.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-medium transition cursor-pointer ${
              viewMode === 'floorplan'
                ? 'bg-[#C89F72] text-[#111315] shadow-sm font-bold'
                : 'text-slate-300 hover:bg-white/5'
            }`}
          >
            <LayoutGrid className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span className="sm:hidden">2D 平面</span>
            <span className="hidden sm:inline">2D 平面配置圖</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Desktop / Tablet Zoom Controls */}
          {viewMode !== 'floorplan' && hasPhoto && (
            <div className="hidden sm:flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))))}
                className="rounded border border-[#2A303B] bg-[#1A1E25] p-1.5 text-slate-300 hover:bg-[#242A33] cursor-pointer"
                title="縮小畫布"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="w-11 text-center font-mono-num text-slate-300">
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

          {/* Mobile / Portrait Sticky Expand / Collapse Canvas Toggle (< 1024px) */}
          <button
            type="button"
            aria-expanded={!mobileCollapsed}
            onClick={() => setMobileCollapsed((prev) => !prev)}
            className="lg:hidden flex items-center gap-1 rounded-md border border-[#C89F72]/50 bg-[#C89F72]/15 px-2.5 py-1 text-[11px] font-bold text-[#E2BE96] hover:bg-[#C89F72]/25 transition cursor-pointer shrink-0"
          >
            {mobileCollapsed ? (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                展開畫布
              </>
            ) : (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                收合畫布
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Interactive Viewport Stage */}
      <div
        ref={stageContainerRef}
        className={`relative min-h-0 flex-1 items-center justify-center overflow-hidden ${
          mobileCollapsed ? 'hidden lg:flex' : 'flex'
        } ${activeTool === 'pan' ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
        onWheel={(e) => {
          if (viewMode === 'floorplan' || !hasPhoto) return;
          if (e.ctrlKey || Math.abs(e.deltaY) > 0) {
            const delta = e.deltaY > 0 ? -0.08 : 0.08;
            setZoom((z) => Math.max(0.5, Math.min(2.6, Number((z + delta).toFixed(2)))));
          }
        }}
        onPointerDown={(e) => {
          if (viewMode === 'floorplan' || !hasPhoto) return;
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
        ) : !hasPhoto ? (
          <div className="flex max-w-md flex-col items-center justify-center rounded-2xl border border-dashed border-[#343C4A] bg-[#14181F]/80 px-5 py-4 sm:px-7 sm:py-7 text-center mx-3">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-[#C89F72]/40 bg-[#C89F72]/15 text-[#E2BE96]">
              <Camera className="h-5 w-5" />
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-100">
              尚未匯入室內現況照片
            </p>
            <p className="mt-1 text-[11px] sm:text-xs text-slate-400">
              請直接拍攝空間現場或從相簿／電腦上傳照片，系統將自動標準化長邊 1280px–1536px（≦300KB）並載入 3D 透視圖層
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (isNativeApp()) pickRoomPhotoNative('camera');
                  else cameraInputRef.current?.click();
                }}
                className="flex items-center gap-1.5 rounded-lg bg-[#C89F72] px-3 py-1.5 text-xs font-bold text-[#111315] hover:bg-[#D8B084] transition cursor-pointer"
              >
                <Camera className="h-3.5 w-3.5" />
                拍攝照片
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isNativeApp()) pickRoomPhotoNative('photos');
                  else fileInputRef.current?.click();
                }}
                className="flex items-center gap-1.5 rounded-lg border border-[#C89F72]/50 bg-[#1B2028] px-3 py-1.5 text-xs font-semibold text-[#E2BE96] hover:bg-[#242B35] transition cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" />
                上傳圖片
              </button>
            </div>
          </div>
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

        {/* AI Processing Indicator Overlay with Progress Bar & AbortController Cancel Button */}
        {isAiBusy && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-[2px]">
            <div className="flex w-full max-w-md flex-col gap-2.5 rounded-xl border border-[#C89F72]/50 bg-[#181B21] px-4 py-3.5 shadow-2xl mx-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Loader2 className="h-5 w-5 animate-spin text-[#C89F72] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-slate-100 truncate">
                      {isAiBusy}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      正在連線 Google Gemini API（已啟用內容雜湊快取與防連點保護）
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={cancelAiGeneration}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-rose-500/50 bg-rose-500/20 px-2.5 py-1 text-[11px] font-bold text-rose-200 hover:bg-rose-500/30 transition cursor-pointer"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  取消生成
                </button>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#242A34]">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-[#C89F72] via-[#E2BE96] to-[#34D399]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Multi-turn Conversational Local Editing Bar (Step 3 after simulation) */}
      {showConversationalBar && (
        <div className="z-20 shrink-0 border-t border-[#232832] bg-[#151921] px-2.5 sm:px-4 py-1.5">
          <form onSubmit={handleSendConversationalEdit} className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 text-[11px] font-bold text-[#E2BE96] shrink-0">
              <MessageSquarePlus className="h-3.5 w-3.5 text-[#C89F72]" />
              <span className="hidden sm:inline">多輪對話局部微調：</span>
              <span className="sm:hidden">局部微調：</span>
            </div>
            <input
              type="text"
              value={chatPrompt}
              disabled={Boolean(isAiBusy)}
              onChange={(e) => setChatPrompt(e.target.value)}
              placeholder="例如：保留目前的沙發與木地板，只把左側的落地燈換成黑色極簡款式..."
              className="min-w-0 flex-1 rounded-lg border border-[#2C3340] bg-[#0F1217] px-2.5 py-1 text-xs text-slate-100 placeholder-slate-500 focus:border-[#C89F72] focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={Boolean(isAiBusy) || !chatPrompt.trim()}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-[#C89F72] px-2.5 py-1 text-xs font-bold text-[#111315] hover:bg-[#D8B084] disabled:opacity-40 transition cursor-pointer"
            >
              <Send className="h-3 w-3" />
              <span>微調送出</span>
            </button>
          </form>
          {conversationalHistory.length > 0 && (
            <div className="mt-1 flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[10px] text-slate-400">
              <span className="shrink-0 text-slate-500">已微調：</span>
              {conversationalHistory.slice(-3).map((msg) => (
                <span
                  key={msg.id}
                  className="shrink-0 rounded border border-emerald-500/30 bg-emerald-950/30 px-1.5 py-0.5 text-emerald-300"
                  title={msg.resultNote}
                >
                  ✓ {msg.instruction}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Unified 7-Tool Canvas Bottom Toolbar with Chinese Labels, Gesture Hint Bar & ? Help Modal */}
      {!mobileCollapsed && <CanvasToolbar />}

      {/* Bottom Spatial Telemetry Status Bar */}
      <footer
        className={`z-20 shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#232832] bg-[#13161B] px-2.5 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-[11px] text-slate-400 ${
          mobileCollapsed ? 'hidden lg:flex' : 'flex'
        }`}
      >
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 sm:gap-4 font-mono-num">
          <span className="flex items-center gap-0.5">
            空間：
            <strong className="inline-block max-w-[105px] sm:max-w-[220px] truncate align-bottom text-slate-200">
              {scene.name}
            </strong>
            <span className="shrink-0">({scene.areaPing} 坪)</span>
          </span>
          <span>
            比例：
            <strong className={calibration.calibrated ? 'text-emerald-400' : 'text-amber-400'}>
              {calibration.pixelPerCm} px/cm
            </strong>
          </span>
          <span className="hidden sm:inline">
            機電保護：
            <strong className="text-sky-400">
              {protectionZones.filter((z) => z.locked).length} 區
            </strong>
          </span>
          <span>
            走道：
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
          {aiRenderDescription && (
            <span className="hidden xl:inline text-emerald-300 truncate max-w-[300px]">
              ✨ {aiRenderDescription}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5 sm:gap-3">
          <span className="hidden sm:inline">色溫 {lighting.kelvin}K</span>
          <span>
            評分：
            <strong className="font-mono-num text-[#E2BE96]">{ergonomics.overallScore}/100</strong>
          </span>
        </div>
      </footer>
    </main>
  );
};
