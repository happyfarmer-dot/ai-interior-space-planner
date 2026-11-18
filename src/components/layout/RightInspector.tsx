import React from 'react';
import { useDesignStore } from '../../store/useDesignStore';
import { Step1ImportCalibratePanel } from '../panels/Step1ImportCalibratePanel';
import { Step2ModePromptPanel } from '../panels/Step2ModePromptPanel';
import { Step3RefineInspectPanel } from '../panels/Step3RefineInspectPanel';
import { Step4ExportBomPanel } from '../panels/Step4ExportBomPanel';

const STEP_META: Record<number, { title: string; subtitle: string }> = {
  1: {
    title: '步驟一｜空間匯入與物理校準',
    subtitle: '功能 1～3｜現況照片匯入、尺度校準與機電結構鎖定',
  },
  2: {
    title: '步驟二｜設計模式與客製需求',
    subtitle: '功能 4～7｜傢俱重排、風格轉換、物件置入與需求解析',
  },
  3: {
    title: '步驟三｜物理檢測與光影材質微調',
    subtitle: '功能 8～10｜紅黃綠燈工學檢測、色溫模擬與局部換材',
  },
  4: {
    title: '步驟四｜採購清單與預算一鍵輸出',
    subtitle: '功能 11～13｜以圖搜物、BOM 預算明細與報表一鍵輸出',
  },
};

export const RightInspector: React.FC<{
  onOpenProposalModal: (opts?: { autoPrint?: boolean }) => void;
}> = ({ onOpenProposalModal }) => {
  const { state } = useDesignStore();
  const { currentStep } = state.present;
  const meta = STEP_META[currentStep];

  return (
    <aside className="no-print order-3 flex w-full min-w-0 shrink-0 flex-col border-t border-[#232832] bg-[#14171C] lg:w-[420px] lg:border-t-0 lg:border-l">
      <div className="border-b border-[#232832] px-4 py-3">
        <h2 className="text-sm font-bold text-slate-100">{meta.title}</h2>
        <p className="mt-0.5 text-[11px] text-slate-400">{meta.subtitle}</p>
      </div>

      <div className="min-w-0 flex-1 overflow-visible p-3.5 sm:p-4 pb-10 lg:overflow-y-auto lg:pb-4">
        {currentStep === 1 && <Step1ImportCalibratePanel />}
        {currentStep === 2 && <Step2ModePromptPanel />}
        {currentStep === 3 && <Step3RefineInspectPanel />}
        {currentStep === 4 && (
          <Step4ExportBomPanel onOpenProposalModal={onOpenProposalModal} />
        )}
      </div>
    </aside>
  );
};
