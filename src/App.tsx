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
  const [showProposalPdf, setShowProposalPdf] = useState(false);
  const [showArchitecture, setShowArchitecture] = useState(false);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0E1013] text-[#E6E8EB]">
      <TopNavbar
        onOpenHistory={() => setShowHistory(true)}
        onOpenProposalPdf={() => setShowProposalPdf(true)}
        onOpenArchitecture={() => setShowArchitecture(true)}
      />

      <div className="no-print flex flex-1 flex-col md:flex-row overflow-hidden">
        <div className="flex flex-1 overflow-hidden">
          <LeftToolRail />
          <MainCanvasViewport />
        </div>
        <RightInspector onOpenProposalModal={() => setShowProposalPdf(true)} />
      </div>

      {showHistory && <VersionHistoryModal onClose={() => setShowHistory(false)} />}
      {showProposalPdf && <ProposalPdfModal onClose={() => setShowProposalPdf(false)} />}
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
