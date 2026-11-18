import React, { useState } from 'react';
import {
  Activity,
  Brush,
  Eraser,
  Hand,
  HelpCircle,
  MousePointer2,
  Pentagon,
  Ruler,
  ScanSearch,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import { useDesignStore } from '../../store/useDesignStore';
import type { ActiveCanvasTool } from '../../types/design';

interface CanvasToolInfo {
  id: ActiveCanvasTool | 'clear_all';
  shortLabel: string;
  title: string;
  gestureHint: string;
  helpSummary: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CANVAS_TOOLBAR_ITEMS: CanvasToolInfo[] = [
  {
    id: 'select',
    shortLabel: '選取',
    title: '1. 選取（游標）',
    gestureHint: '點擊畫面上的建議高亮區、材質區塊或商品藍框以檢視詳情',
    helpSummary: '預設點選模式：可點選建議擺放高亮區、局部材質區或功能 11 的單品藍框。',
    icon: MousePointer2,
  },
  {
    id: 'pan',
    shortLabel: '平移',
    title: '2. 平移（手掌）',
    gestureHint: '單指拖曳可移動畫布視角，雙指或滾輪可縮放檢視細節',
    helpSummary: '按住畫布拖曳即可平移視角，搭配放大縮小檢視裝潢細節。',
    icon: Hand,
  },
  {
    id: 'ruler',
    shortLabel: '拉尺',
    title: '3. 拉尺（尺規）',
    gestureHint: '按住已知尺寸物體（如房門高 210cm）起點拖曳至終點完成比例尺校準（觸控時上方顯示 2.5x 放大鏡）',
    helpSummary: '用於功能 2 空間尺度校準：拉出參考線段即可換算真實 px/cm 比例尺。',
    icon: Ruler,
  },
  {
    id: 'brush_mask',
    shortLabel: '筆刷',
    title: '4. 筆刷（畫筆）',
    gestureHint: '直接於窗戶、冷氣或總配電箱上塗抹建立不可更動保護遮罩',
    helpSummary: '用於功能 3 機電結構鎖定：自由塗抹不希望被 AI 覆蓋的窗戶、冷氣或配電箱。',
    icon: Brush,
  },
  {
    id: 'polygon_mask',
    shortLabel: '多邊形',
    title: '5. 多邊形（頂點框選）',
    gestureHint: '依序點擊或拖曳頂點框選結構樑柱／窗面，點回起點黃色圓點即可閉合（支援 2.5x 觸控放大鏡）',
    helpSummary: '用於功能 3 幾何框選：依序標出多邊形頂點並點回起點，精準鎖定門窗或樑柱。',
    icon: Pentagon,
  },
  {
    id: 'eraser',
    shortLabel: '橡皮擦',
    title: '6. 橡皮擦（局部擦除）',
    gestureHint: '點擊或滑過已標記的筆刷／多邊形保護遮罩即可局部擦除該標記',
    helpSummary: '在畫布上滑過或點擊誤畫的筆刷與多邊形遮罩，即可單獨將該保護區擦除。',
    icon: Eraser,
  },
  {
    id: 'clear_all',
    shortLabel: '全部清除',
    title: '7. 全部清除（垃圾桶）',
    gestureHint: '一鍵清空畫布上所有機電保護遮罩與比例尺拉線（需二次確認防誤觸）',
    helpSummary: '清除畫布上全部保護遮罩與自訂拉線標記，點擊後會要求二次確認。',
    icon: Trash2,
  },
];

export const CanvasToolbar: React.FC = () => {
  const {
    state,
    dispatch,
    activeTool,
    setActiveTool,
    showProtectionOverlay,
    setShowProtectionOverlay,
    showErgonomicsOverlay,
    setShowErgonomicsOverlay,
    showVisualSearchOverlay,
    setShowVisualSearchOverlay,
  } = useDesignStore();

  const [confirmingClearAll, setConfirmingClearAll] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const { viewMode, scene } = state.present;
  const hasPhoto = Boolean(scene.imageUrl);

  const currentToolInfo =
    CANVAS_TOOLBAR_ITEMS.find((t) => t.id === activeTool) ?? CANVAS_TOOLBAR_ITEMS[0];

  const extraGestureHint =
    activeTool === 'material_pick'
      ? '局部材質點選模式：請直接點擊畫面中的地板、主牆面、沙發或窗簾區塊'
      : activeTool === 'manual_box_select'
      ? '手動框選單品模式：請在模擬圖上按住並拖曳出矩形框，放開後即由 Gemini 辨識單品與購買連結'
      : currentToolInfo.gestureHint;

  const handleSelectTool = (toolId: CanvasToolInfo['id']) => {
    if (toolId === 'clear_all') {
      setConfirmingClearAll(true);
      return;
    }
    setConfirmingClearAll(false);
    setActiveTool(toolId);
    if (viewMode !== 'perspective') {
      dispatch({ type: 'SET_VIEW_MODE', viewMode: 'perspective' });
    }
  };

  return (
    <>
      <div className="z-20 shrink-0 border-t border-[#232832] bg-[#14171C]">
        {/* Real-time Gesture Hint Bar directly above toolbar */}
        <div className="flex items-center justify-between gap-2 border-b border-[#20252F] bg-[#101318] px-2.5 sm:px-4 py-1 text-[11px] text-[#E8CFAF]">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="shrink-0 rounded bg-[#C89F72]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#E2BE96]">
              手勢提示
            </span>
            <span className="truncate">{extraGestureHint}</span>
          </div>

          {confirmingClearAll && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10.5px] font-semibold text-rose-300">確定清除全部遮罩？</span>
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: 'CLEAR_CANVAS_MASKS' });
                  setConfirmingClearAll(false);
                  setActiveTool('select');
                }}
                className="rounded bg-rose-500 px-2 py-0.5 text-[10.5px] font-bold text-white hover:bg-rose-600 cursor-pointer"
              >
                確認清除
              </button>
              <button
                type="button"
                onClick={() => setConfirmingClearAll(false)}
                className="rounded border border-slate-600 px-1.5 py-0.5 text-[10.5px] text-slate-300 hover:bg-white/5 cursor-pointer"
              >
                取消
              </button>
            </div>
          )}
        </div>

        {/* 7 Distinct Tools + Layer Toggles + Rightmost "? 說明" Button */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto px-2 sm:px-3 py-1.5">
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {CANVAS_TOOLBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              const isClearBtn = item.id === 'clear_all';
              const active = !isClearBtn && activeTool === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!hasPhoto && item.id !== 'select'}
                  title={item.title}
                  onClick={() => handleSelectTool(item.id)}
                  className={`flex flex-col items-center justify-center rounded-lg border px-2 py-1 min-w-[46px] sm:min-w-[52px] transition shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    isClearBtn && confirmingClearAll
                      ? 'border-rose-400 bg-rose-500/25 text-rose-200'
                      : active
                      ? 'border-[#C89F72] bg-[#C89F72]/20 text-[#E2BE96] shadow-xs'
                      : isClearBtn
                      ? 'border-transparent text-rose-300/80 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-200'
                      : 'border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="mt-0.5 text-[10px] font-medium leading-tight whitespace-nowrap">
                    {item.shortLabel}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 border-l border-[#252B36] pl-2 shrink-0">
            <button
              type="button"
              title={showProtectionOverlay ? '隱藏機電結構保護圖層' : '顯示機電結構保護圖層'}
              onClick={() => setShowProtectionOverlay(!showProtectionOverlay)}
              className={`flex flex-col items-center justify-center rounded-lg border px-2 py-1 min-w-[44px] transition cursor-pointer ${
                showProtectionOverlay
                  ? 'border-sky-500/40 bg-sky-500/15 text-sky-300'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              <span className="mt-0.5 text-[9.5px] leading-tight whitespace-nowrap">保護層</span>
            </button>

            <button
              type="button"
              title={showErgonomicsOverlay ? '隱藏動線工學標註' : '顯示動線工學標註'}
              onClick={() => setShowErgonomicsOverlay(!showErgonomicsOverlay)}
              className={`flex flex-col items-center justify-center rounded-lg border px-2 py-1 min-w-[44px] transition cursor-pointer ${
                showErgonomicsOverlay
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              <span className="mt-0.5 text-[9.5px] leading-tight whitespace-nowrap">動線尺</span>
            </button>

            <button
              type="button"
              title={showVisualSearchOverlay ? '隱藏單品採購藍框' : '顯示單品採購藍框'}
              onClick={() => setShowVisualSearchOverlay(!showVisualSearchOverlay)}
              className={`flex flex-col items-center justify-center rounded-lg border px-2 py-1 min-w-[44px] transition cursor-pointer ${
                showVisualSearchOverlay
                  ? 'border-[#C89F72]/50 bg-[#C89F72]/15 text-[#E2BE96]'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <ScanSearch className="h-3.5 w-3.5" />
              <span className="mt-0.5 text-[9.5px] leading-tight whitespace-nowrap">搜物框</span>
            </button>

            {/* Rightmost prominent "? 說明" legend button */}
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="flex items-center gap-1 rounded-lg border border-[#C89F72]/60 bg-[#C89F72]/20 px-2.5 py-1.5 text-xs font-bold text-[#F2D6B3] hover:bg-[#C89F72]/30 transition shrink-0 cursor-pointer"
            >
              <HelpCircle className="h-3.5 w-3.5 text-[#E2BE96]" />
              <span>？說明</span>
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Tools Legend Modal / Bottom Sheet */}
      {showHelpModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="畫布工具使用說明卡"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4 backdrop-blur-xs"
          onClick={() => setShowHelpModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-[#2E3543] bg-[#161920] p-4 sm:p-5 text-slate-100 shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#252B36] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#E2BE96]">
                  畫布工具使用說明卡（7 大核心工具圖例）
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  手機觸控拉線或框選多邊形頂點時，手指上方會自動浮現 2.5 倍十字準心放大鏡
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer"
                aria-label="關閉說明視窗"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {CANVAS_TOOLBAR_ITEMS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <div
                    key={tool.id}
                    className="flex items-start gap-3 rounded-xl border border-[#252B36] bg-[#111419] p-2.5"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#C89F72]/40 bg-[#C89F72]/15 text-[#E2BE96]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-100">{tool.title}</span>
                        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-300">
                          {tool.shortLabel}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-300">
                        {tool.helpSummary}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="rounded-lg bg-[#C89F72] px-4 py-2 text-xs font-bold text-[#111315] hover:bg-[#D8B084] cursor-pointer"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
