import React from 'react';
import { Cpu, FolderTree, Layers, ShieldCheck, X } from 'lucide-react';
import { getAIServiceConfig } from '../../services/aiConfig';

export const ArchitectureInfoModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const cfg = getAIServiceConfig();

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-2xl border border-[#2D3440] bg-[#16191F] text-slate-200 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#262B35] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-100">
              系統架構、檔案目錄與 AI 管線抽象層規格
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#282E39] bg-[#111419] p-3.5">
              <div className="mb-2 flex items-center gap-1.5 font-semibold text-[#DFBA8C]">
                <FolderTree className="h-4 w-4" />
                模組化專案目錄結構
              </div>
              <pre className="font-mono-num text-[10.5px] leading-relaxed text-slate-300 overflow-x-auto">
{`src/
├── types/design.ts           # 11大模組型別契約
├── data/                     # 風格庫/材質庫/台灣家居規格庫
├── services/
│   ├── aiConfig.ts           # 環境變數與模式讀取
│   ├── aiPipeline.ts         # VLM/Diffusion/LLM 抽象介面
│   └── mockAiEngine.ts       # 離線互動演算與完整模擬
├── store/
│   ├── reducer.ts            # 不可變狀態機 + Undo/Redo + 快照
│   └── useDesignStore.ts     # Context & 即時工學/BOM推導
├── utils/
│   ├── geometry.ts           # 比例尺、門扇碰撞與距離幾何
│   ├── ergonomics.ts         # 紅黃綠燈人體工學檢測
│   ├── bomCalculator.ts      # 台灣行情 BOM 估算引擎
│   └── imageProcessing.ts    # 去背演算法與 Canvas 光影合成
└── components/               # 畫布圖層、四步驟面板與報表`}
              </pre>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-[#282E39] bg-[#111419] p-3.5">
                <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-sky-300">
                  <Layers className="h-4 w-4" />
                  目前 AI 管線運行狀態
                </div>
                <p className="text-[11px] text-slate-300">
                  模式：
                  <strong className="ml-1 text-emerald-400">
                    {cfg.mode === 'live' ? 'Live External APIs' : 'Mock Simulation (預設展示模式)'}
                  </strong>
                </p>
                <ul className="mt-2 space-y-1 text-[11px] text-slate-400">
                  <li>• VLM 視覺辨識端點：{cfg.vlmEndpoint}</li>
                  <li>• Diffusion / Inpainting 端點：{cfg.diffusionEndpoint}</li>
                  <li>• LLM 需求解析端點：{cfg.llmEndpoint}</li>
                </ul>
              </div>

              <div className="rounded-xl border border-[#282E39] bg-[#111419] p-3.5">
                <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-amber-300">
                  <ShieldCheck className="h-4 w-4" />
                  物理限制優先原則
                </div>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  所有生成與重排任務皆先經過 <code className="text-slate-200">evaluateErgonomics()</code>{' '}
                  與 <code className="text-slate-200">protectionZones</code> 幾何碰撞核對，嚴格禁止封死採光窗、遮擋冷氣出風口與總配電箱，並依實測比例尺運算真實公分數值。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
