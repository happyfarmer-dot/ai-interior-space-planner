import React from 'react';
import {
  BookmarkPlus,
  Compass,
  Cpu,
  FileText,
  History,
  Redo2,
  RotateCcw,
  Undo2,
} from 'lucide-react';
import { getAIServiceConfig } from '../../services/aiConfig';
import { useDesignStore } from '../../store/useDesignStore';
import type { WorkflowStep } from '../../types/design';

const STEPS: Array<{ step: WorkflowStep; label: string }> = [
  { step: 1, label: '1. 匯入與校準' },
  { step: 2, label: '2. 模式與需求' },
  { step: 3, label: '3. 生成與檢測' },
  { step: 4, label: '4. 清單與匯出' },
];

interface TopNavbarProps {
  onOpenHistory: () => void;
  onOpenProposalPdf: () => void;
  onOpenArchitecture: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  onOpenHistory,
  onOpenProposalPdf,
  onOpenArchitecture,
}) => {
  const { state, dispatch, bom } = useDesignStore();
  const { currentStep } = state.present;
  const aiCfg = getAIServiceConfig();

  const canUndo = state.undoStack.length > 0;
  const canRedo = state.redoStack.length > 0;

  return (
    <header className="no-print flex h-14 shrink-0 items-center justify-between border-b border-[#232832] bg-[#14171C] px-4 gap-3">
      {/* Brand Title */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#C89F72]/50 bg-[#C89F72]/15 text-[#DFBA8C]">
          <Compass className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <h1 className="text-sm font-bold tracking-tight text-slate-100">
            空間智繪 <span className="font-medium text-[#C89F72]">SpatialMind AI</span>
          </h1>
          <p className="text-[10px] text-slate-400">物理邏輯 × 商業預算 室內空間輔助系統</p>
        </div>
      </div>

      {/* 4-Step Workflow Stepper */}
      <nav aria-label="設計流程步驟" className="hidden xl:flex items-center gap-1 rounded-xl border border-[#272D38] bg-[#0F1216] p-1">
        {STEPS.map((item, idx) => {
          const active = currentStep === item.step;
          const completed = currentStep > item.step;
          return (
            <React.Fragment key={item.step}>
              <button
                type="button"
                onClick={() => dispatch({ type: 'SET_STEP', step: item.step })}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                  active
                    ? 'bg-[#C89F72] text-[#111315] font-bold shadow-sm'
                    : completed
                    ? 'text-emerald-300 hover:bg-white/5'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
              {idx < STEPS.length - 1 && (
                <span className="px-0.5 text-slate-600 text-xs">/</span>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {/* Compact Stepper for narrower viewports */}
      <div className="flex xl:hidden items-center gap-1">
        {STEPS.map((item) => (
          <button
            key={item.step}
            type="button"
            onClick={() => dispatch({ type: 'SET_STEP', step: item.step })}
            className={`rounded px-2 py-1 text-xs font-semibold cursor-pointer ${
              currentStep === item.step
                ? 'bg-[#C89F72] text-[#111315]'
                : 'bg-[#1D222A] text-slate-400'
            }`}
          >
            S{item.step}
          </button>
        ))}
      </div>

      {/* Right Tools: Undo/Redo, Snapshots, API Architecture, Export */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="flex items-center rounded-lg border border-[#272D38] bg-[#191D24] p-0.5">
          <button
            type="button"
            disabled={!canUndo}
            onClick={() => dispatch({ type: 'UNDO' })}
            className="rounded p-1.5 text-slate-300 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            title="復原上一步 (Ctrl+Z)"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={() => dispatch({ type: 'REDO' })}
            className="rounded p-1.5 text-slate-300 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            title="重做下一步 (Ctrl+Y)"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'RESET_ALL_EDITS' })}
            className="rounded p-1.5 text-slate-400 hover:bg-white/5 hover:text-amber-300 cursor-pointer"
            title="重設所有修改回到現況圖"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() =>
            dispatch({
              type: 'SAVE_SNAPSHOT',
              name: `方案版本 v${state.snapshots.length}`,
              summary: `預估約 NT$${Math.round((bom.grandMinTWD + bom.grandMaxTWD) / 2).toLocaleString()}`,
            })
          }
          className="hidden sm:flex items-center gap-1 rounded-lg border border-[#272D38] bg-[#191D24] px-2.5 py-1.5 text-xs text-slate-200 hover:border-[#C89F72]/50 transition cursor-pointer"
          title="將目前配置存為設計版本快照"
        >
          <BookmarkPlus className="h-3.5 w-3.5 text-[#C89F72]" />
          <span className="hidden md:inline">存快照</span>
        </button>

        <button
          type="button"
          onClick={onOpenHistory}
          className="flex items-center gap-1 rounded-lg border border-[#272D38] bg-[#191D24] px-2.5 py-1.5 text-xs text-slate-200 hover:border-slate-500 transition cursor-pointer"
        >
          <History className="h-3.5 w-3.5 text-sky-400" />
          <span className="hidden md:inline">版本</span>
          <span className="font-mono-num rounded bg-[#272D38] px-1 text-[10px] text-slate-300">
            {state.snapshots.length}
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenArchitecture}
          className="hidden lg:flex items-center gap-1.5 rounded-lg border border-[#272D38] bg-[#191D24] px-2.5 py-1.5 text-[11px] text-slate-300 hover:border-sky-400/50 transition cursor-pointer"
          title="檢視系統架構與 AI Service API 整合規格"
        >
          <Cpu className="h-3.5 w-3.5 text-emerald-400" />
          <span>{aiCfg.mode === 'live' ? 'Live API' : 'Mock AI 就緒'}</span>
        </button>

        <button
          type="button"
          onClick={onOpenProposalPdf}
          className="flex items-center gap-1.5 rounded-lg bg-[#C89F72] px-3 py-1.5 text-xs font-bold text-[#111315] hover:bg-[#D8B084] transition cursor-pointer"
        >
          <FileText className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">匯出企劃書</span>
        </button>
      </div>
    </header>
  );
};
