import React from 'react';
import {
  BookmarkPlus,
  Compass,
  Cpu,
  FileText,
  History,
  KeyRound,
  Redo2,
  RotateCcw,
  Sparkles,
  Undo2,
} from 'lucide-react';
import { useDesignStore } from '../../store/useDesignStore';
import type { WorkflowStep } from '../../types/design';

const STEPS: Array<{ step: WorkflowStep; label: string; shortLabel: string }> = [
  { step: 1, label: '1. 空間與校準', shortLabel: '1. 空間校準' },
  { step: 2, label: '2. 模式與需求', shortLabel: '2. 設計模式' },
  { step: 3, label: '3. 檢測與微調', shortLabel: '3. 檢測微調' },
  { step: 4, label: '4. 採購與輸出', shortLabel: '4. 預算輸出' },
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
  const { state, dispatch, bom, geminiConfig, setShowGeminiSettings } = useDesignStore();
  const { currentStep } = state.present;

  const geminiReady = Boolean(geminiConfig.apiKey.trim());
  const canUndo = state.undoStack.length > 0;
  const canRedo = state.redoStack.length > 0;

  return (
    <header className="no-print flex w-full shrink-0 flex-wrap sm:flex-nowrap items-center justify-between gap-x-2 gap-y-1.5 sm:gap-3 border-b border-[#232832] bg-[#14171C] px-2.5 sm:px-4 pt-[max(0.375rem,env(safe-area-inset-top))] pb-1.5 sm:py-0 sm:h-14">
      {/* Brand Title */}
      <div className="order-1 flex items-center gap-2 sm:gap-2.5 min-w-0 shrink-0">
        <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg border border-[#C89F72]/50 bg-[#C89F72]/15 text-[#DFBA8C]">
          <Compass className="h-4 w-4" />
        </div>
        <div className="leading-tight min-w-0">
          <h1 className="text-xs sm:text-sm font-bold tracking-tight text-slate-100 truncate">
            空間智繪 <span className="hidden sm:inline font-medium text-[#C89F72]">SpatialMind AI</span>
          </h1>
          <p className="hidden sm:block text-[10px] text-slate-400">
            物理邏輯 × Gemini AI 實景室內設計系統
          </p>
        </div>
      </div>

      {/* 4-Step Workflow Stepper (Desktop XL+) */}
      <nav
        aria-label="設計流程步驟"
        className="order-2 hidden xl:flex items-center gap-1 rounded-xl border border-[#272D38] bg-[#0F1216] p-1"
      >
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

      {/* Compact Stepper for Tablet/Mobile */}
      <div className="order-3 sm:order-2 grid w-full grid-cols-4 gap-1 sm:flex sm:w-auto sm:items-center sm:gap-1 xl:hidden">
        {STEPS.map((item) => {
          const active = currentStep === item.step;
          return (
            <button
              key={item.step}
              type="button"
              onClick={() => dispatch({ type: 'SET_STEP', step: item.step })}
              className={`rounded-md px-1 sm:px-2 py-1 text-[10.5px] sm:text-xs font-semibold text-center truncate cursor-pointer transition ${
                active
                  ? 'bg-[#C89F72] text-[#111315] font-bold'
                  : 'bg-[#1D222A] text-slate-300 hover:text-white'
              }`}
            >
              <span className="sm:hidden">{item.shortLabel}</span>
              <span className="hidden sm:inline">S{item.step}</span>
            </button>
          );
        })}
      </div>

      {/* Right Tools: Undo/Redo, Gemini Key Config, Snapshots, Architecture, Export */}
      <div className="order-2 sm:order-3 flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Gemini API Status & Settings Trigger (Always visible on mobile & desktop) */}
        <button
          type="button"
          onClick={() => setShowGeminiSettings(true)}
          className={`flex items-center gap-1 rounded-lg border px-2 sm:px-2.5 py-1 sm:py-1.5 text-[11px] font-bold transition cursor-pointer ${
            geminiReady
              ? 'border-emerald-500/45 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
              : 'border-amber-400/60 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
          }`}
          title={`設定 Google Gemini API Key 與模型（目前圖像模型：${geminiConfig.imageModel}）`}
        >
          {geminiReady ? (
            <>
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              <span className="hidden md:inline">Gemini 已連線</span>
              <span className="md:hidden">AI就緒</span>
            </>
          ) : (
            <>
              <KeyRound className="h-3.5 w-3.5 text-amber-300" />
              <span className="hidden md:inline">設定 Gemini Key</span>
              <span className="md:hidden">設定Key</span>
            </>
          )}
        </button>

        <div className="flex items-center rounded-lg border border-[#272D38] bg-[#191D24] p-0.5">
          <button
            type="button"
            disabled={!canUndo}
            onClick={() => dispatch({ type: 'UNDO' })}
            className="rounded p-1 sm:p-1.5 text-slate-300 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            title="復原上一步 (Ctrl+Z)"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={() => dispatch({ type: 'REDO' })}
            className="rounded p-1 sm:p-1.5 text-slate-300 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            title="重做下一步 (Ctrl+Y)"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'RESET_ALL_EDITS' })}
            className="rounded p-1 sm:p-1.5 text-slate-400 hover:bg-white/5 hover:text-amber-300 cursor-pointer"
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
          className="flex items-center gap-1 rounded-lg border border-[#272D38] bg-[#191D24] px-2 sm:px-2.5 py-1 sm:py-1.5 text-xs text-slate-200 hover:border-slate-500 transition cursor-pointer"
          title="歷史版本快照"
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
          className="hidden lg:flex items-center gap-1.5 rounded-lg border border-[#272D38] bg-[#191D24] px-2 py-1.5 text-[11px] text-slate-300 hover:border-sky-400/50 transition cursor-pointer"
          title="檢視系統架構與 AI 管線規格"
        >
          <Cpu className="h-3.5 w-3.5 text-sky-400" />
          <span>架構</span>
        </button>

        <button
          type="button"
          onClick={onOpenProposalPdf}
          className="flex items-center gap-1 rounded-lg bg-[#C89F72] px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold text-[#111315] hover:bg-[#D8B084] transition cursor-pointer"
          title="預覽與匯出企劃書"
        >
          <FileText className="h-3.5 w-3.5" />
          <span className="sm:hidden">企劃書</span>
          <span className="hidden sm:inline">匯出企劃書</span>
        </button>
      </div>
    </header>
  );
};
