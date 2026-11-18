import React from 'react';
import { useDesignStore } from '../../store/useDesignStore';
import { Step1ImportCalibratePanel } from '../panels/Step1ImportCalibratePanel';
import { Step2ModePromptPanel } from '../panels/Step2ModePromptPanel';
import { Step3RefineInspectPanel } from '../panels/Step3RefineInspectPanel';
import { Step4ExportBomPanel } from '../panels/Step4ExportBomPanel';

const STEP_META: Record<number, { title: string; subtitle: string }> = {
  1: {
    title: '步驟一｜匯入空間與尺度校準',
    subtitle: '完成比例尺拉線與不可更動結構保護鎖定',
  },
  2: {
    title: '步驟二｜設計模式與客製需求',
    subtitle: '選擇空間變動模式並解析自然語言約束條件',
  },
  3: {
    title: '步驟三｜生成檢測與光影材質微調',
    subtitle: '檢視紅黃綠燈人體工學報告、色溫與局部材質',
  },
  4: {
    title: '步驟四｜商品搜物與預算企劃匯出',
    subtitle: '實體規格比對、台灣行情 BOM 估算與企劃書',
  },
};

export const RightInspector: React.FC<{ onOpenProposalModal: () => void }> = ({
  onOpenProposalModal,
}) => {
  const { state } = useDesignStore();
  const { currentStep } = state.present;
  const meta = STEP_META[currentStep];

  return (
    <aside className="no-print flex w-full md:w-[390px] lg:w-[415px] shrink-0 flex-col border-l border-[#232832] bg-[#14171C]">
      <div className="border-b border-[#232832] px-4 py-3">
        <h2 className="text-sm font-bold text-slate-100">{meta.title}</h2>
        <p className="mt-0.5 text-[11px] text-slate-400">{meta.subtitle}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
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
