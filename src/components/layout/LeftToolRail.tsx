import React from 'react';
import {
  Activity,
  Brush,
  Hand,
  MousePointer2,
  Paintbrush,
  Pentagon,
  Ruler,
  ScanSearch,
  Shield,
} from 'lucide-react';
import { useDesignStore } from '../../store/useDesignStore';
import type { ActiveCanvasTool } from '../../types/design';

const TOOLS: Array<{
  id: ActiveCanvasTool;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'select', label: '選取 / 點擊操作', icon: MousePointer2 },
  { id: 'pan', label: '平移拖曳畫布', icon: Hand },
  { id: 'ruler', label: '尺度比例尺拉線 (M5)', icon: Ruler },
  { id: 'brush_mask', label: '機電保護筆刷 (M7)', icon: Brush },
  { id: 'polygon_mask', label: '機電保護多邊形 (M7)', icon: Pentagon },
  { id: 'material_pick', label: '局部表面材質點選 (M9)', icon: Paintbrush },
];

export const LeftToolRail: React.FC = () => {
  const {
    activeTool,
    setActiveTool,
    showProtectionOverlay,
    setShowProtectionOverlay,
    showErgonomicsOverlay,
    setShowErgonomicsOverlay,
    showVisualSearchOverlay,
    setShowVisualSearchOverlay,
    dispatch,
    state,
  } = useDesignStore();

  const { viewMode } = state.present;

  return (
    <aside className="no-print flex w-13 shrink-0 flex-col items-center justify-between border-r border-[#232832] bg-[#14171C] py-3">
      {/* Primary CAD Tools */}
      <div className="flex flex-col items-center gap-1.5">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const active = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              title={tool.label}
              onClick={() => {
                setActiveTool(tool.id);
                if (viewMode !== 'perspective') {
                  dispatch({ type: 'SET_VIEW_MODE', viewMode: 'perspective' });
                }
              }}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border transition cursor-pointer ${
                active
                  ? 'border-[#C89F72] bg-[#C89F72]/20 text-[#E2BE96]'
                  : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>

      {/* Bottom Layer Visibility Toggles */}
      <div className="flex flex-col items-center gap-1.5 border-t border-[#232832] pt-3">
        <button
          type="button"
          title={showProtectionOverlay ? '隱藏機電結構保護圖層' : '顯示機電結構保護圖層'}
          onClick={() => setShowProtectionOverlay(!showProtectionOverlay)}
          className={`flex h-9 w-9 items-center justify-center rounded-lg border transition cursor-pointer ${
            showProtectionOverlay
              ? 'border-sky-500/40 bg-sky-500/15 text-sky-300'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          <Shield className="h-4 w-4" />
        </button>

        <button
          type="button"
          title={showErgonomicsOverlay ? '隱藏動線工學標註' : '顯示動線工學標註'}
          onClick={() => setShowErgonomicsOverlay(!showErgonomicsOverlay)}
          className={`flex h-9 w-9 items-center justify-center rounded-lg border transition cursor-pointer ${
            showErgonomicsOverlay
              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          <Activity className="h-4 w-4" />
        </button>

        <button
          type="button"
          title={showVisualSearchOverlay ? '隱藏以圖搜物框選' : '顯示以圖搜物框選'}
          onClick={() => setShowVisualSearchOverlay(!showVisualSearchOverlay)}
          className={`flex h-9 w-9 items-center justify-center rounded-lg border transition cursor-pointer ${
            showVisualSearchOverlay
              ? 'border-[#C89F72]/50 bg-[#C89F72]/15 text-[#E2BE96]'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          <ScanSearch className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
};
