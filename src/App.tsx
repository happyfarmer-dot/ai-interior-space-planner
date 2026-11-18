import React, { useState } from 'react';
import { AlertTriangle, KeyRound, X } from 'lucide-react';
import { MainCanvasViewport } from './components/canvas/MainCanvasViewport';
import { LeftToolRail } from './components/layout/LeftToolRail';
import { RightInspector } from './components/layout/RightInspector';
import { TopNavbar } from './components/layout/TopNavbar';
import { ArchitectureInfoModal } from './components/modals/ArchitectureInfoModal';
import { GeminiSettingsModal } from './components/modals/GeminiSettingsModal';
import { ProposalPdfModal } from './components/modals/ProposalPdfModal';
import { VersionHistoryModal } from './components/modals/VersionHistoryModal';
import { DesignProvider, useDesignStore } from './store/useDesignStore';

const StudioShell: React.FC = () => {
  const { showGeminiSettings, setShowGeminiSettings, aiError, clearAiError } = useDesignStore();
  const [showHistory, setShowHistory] = useState(false);
  const [proposalModalState, setProposalModalState] = useState<{
    open: boolean;
    autoPrint: boolean;
  }>({ open: false, autoPrint: false });
  const [showArchitecture, setShowArchitecture] = useState(false);

  return (
    <div className="flex min-h-[100dvh] w-full max-w-full flex-col overflow-x-clip bg-[#0E1013] pb-[env(safe-area-inset-bottom)] text-[#E6E8EB] lg:h-screen lg:overflow-hidden">
      <TopNavbar
        onOpenHistory={() => setShowHistory(true)}
        onOpenProposalPdf={() => setProposalModalState({ open: true, autoPrint: false })}
        onOpenArchitecture={() => setShowArchitecture(true)}
      />

      {/* Global Gemini AI diagnostic / error banner when settings modal isn't open */}
      {aiError && !showGeminiSettings && (
        <div
          role="alert"
          className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-rose-500/40 bg-rose-950/75 px-3 sm:px-4 py-2 text-xs text-rose-100"
        >
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <span className="leading-relaxed">{aiError.message}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowGeminiSettings(true)}
              className="flex items-center gap-1 rounded-md border border-amber-400/50 bg-amber-500/20 px-2.5 py-1 text-[11px] font-bold text-amber-200 hover:bg-amber-500/30 cursor-pointer"
            >
              <KeyRound className="h-3 w-3" />
              檢查 Gemini 模型／Key
            </button>
            <button
              type="button"
              onClick={clearAiError}
              aria-label="關閉錯誤提示"
              className="rounded p-1 text-rose-300 hover:bg-white/10 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* < 1024px: vertical stacked layout allowing natural page scroll + sticky preview at top
          >= 1024px (lg): classic desktop CAD split workspace */}
      <div className="no-print flex min-w-0 flex-1 flex-col lg:flex-row lg:overflow-hidden">
        <LeftToolRail />
        <MainCanvasViewport />
        <RightInspector
          onOpenProposalModal={(opts) =>
            setProposalModalState({ open: true, autoPrint: Boolean(opts?.autoPrint) })
          }
        />
      </div>

      {showHistory && <VersionHistoryModal onClose={() => setShowHistory(false)} />}
      {proposalModalState.open && (
        <ProposalPdfModal
          autoPrintOnOpen={proposalModalState.autoPrint}
          onClose={() => setProposalModalState({ open: false, autoPrint: false })}
        />
      )}
      {showArchitecture && <ArchitectureInfoModal onClose={() => setShowArchitecture(false)} />}
      {showGeminiSettings && <GeminiSettingsModal onClose={() => setShowGeminiSettings(false)} />}
    </div>
  );
};

export function App() {
  return (
    <DesignProvider>
      <StudioShell />
    </DesignProvider>
  );
}

export default App;
