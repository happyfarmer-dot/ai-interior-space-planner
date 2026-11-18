import React, { useState } from 'react';
import { MainCanvasViewport } from './components/canvas/MainCanvasViewport';
import { LeftToolRail } from './components/layout/LeftToolRail';
import { RightInspector } from './components/layout/RightInspector';
import { TopNavbar } from './components/layout/TopNavbar';
import { ArchitectureInfoModal } from './components/modals/ArchitectureInfoModal';
import { ProposalPdfModal } from './components/modals/ProposalPdfModal';
import { VersionHistoryModal } from './components/modals/VersionHistoryModal';
import { DesignProvider } from './store/useDesignStore';

const StudioShell: React.FC = () => {
  const [showHistory, setShowHistory] = useState(false);
  const [proposalModalState, setProposalModalState] = useState<{
    open: boolean;
    autoPrint: boolean;
  }>({ open: false, autoPrint: false });
  const [showArchitecture, setShowArchitecture] = useState(false);

  return (
    <div className="flex min-h-[100dvh] w-full max-w-full flex-col overflow-x-clip bg-[#0E1013] text-[#E6E8EB] lg:h-screen lg:overflow-hidden">
      <TopNavbar
        onOpenHistory={() => setShowHistory(true)}
        onOpenProposalPdf={() => setProposalModalState({ open: true, autoPrint: false })}
        onOpenArchitecture={() => setShowArchitecture(true)}
      />

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
