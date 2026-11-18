import React from 'react';
import { Cpu, FolderTree, Layers, ShieldCheck, Smartphone, X } from 'lucide-react';
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
              系統架構、Gemini AI 管線與 Android APK 原生整合規格
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
├── types/design.ts           # 13大空間設計與AI渲染契約
├── data/                     # 風格庫/材質庫/台灣家居規格庫
├── services/
│   ├── aiConfig.ts           # Gemini API Key + Preferences 持久化
│   ├── geminiClient.ts       # VLM辨識/重排規劃/Nano Banana生圖
│   └── aiPipeline.ts         # AI 管線服務統一介面
├── store/
│   ├── reducer.ts            # 狀態機 + 提案影像快取 + Undo/Redo
│   └── useDesignStore.tsx    # Context & 即時工學/BOM推導
├── utils/
│   ├── nativePlatform.ts     # Capacitor 相機/檔案分享/狀態列
│   ├── geometry.ts           # 比例尺、門扇碰撞與距離幾何
│   ├── ergonomics.ts         # 紅黃綠燈人體工學檢測
│   ├── bomCalculator.ts      # 台灣行情 BOM 估算引擎
│   ├── exportUtils.ts        # 原生 Share / CSV / LINE 明細匯出
│   └── imageProcessing.ts    # Base64壓縮、去背與Canvas合成
└── android/                  # Capacitor 8 Android APK 原生專案`}
              </pre>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-[#282E39] bg-[#111419] p-3.5">
                <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-sky-300">
                  <Layers className="h-4 w-4" />
                  目前 Gemini AI 管線狀態
                </div>
                <p className="text-[11px] text-slate-300">
                  狀態：
                  <strong className={cfg.mode === 'live' ? 'ml-1 text-emerald-400' : 'ml-1 text-amber-400'}>
                    {cfg.mode === 'live' ? '已連線 Google Gemini API' : '尚未設定 API Key'}
                  </strong>
                </p>
                <ul className="mt-2 space-y-1 text-[11px] text-slate-400">
                  <li>• Vision 空間分析模型：<code className="text-slate-200">{cfg.visionModel}</code></li>
                  <li>• Native Image 生圖模型：<code className="text-slate-200">{cfg.imageModel}</code></li>
                  <li>• 端點：<span className="break-all font-mono-num">generativelanguage.googleapis.com/v1beta</span></li>
                </ul>
              </div>

              <div className="rounded-xl border border-[#282E39] bg-[#111419] p-3.5">
                <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-emerald-300">
                  <Smartphone className="h-4 w-4" />
                  Android APK 原生能力（Capacitor 8）
                </div>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  支援 Android 相機即時拍攝與相簿選取（含低記憶體 Activity 重建照片回復）、本機 Safe Preferences 金鑰保存，並於步驟四使用系統原生 Share Sheet 匯出 UTF-8 BOM CSV／企劃書 HTML／LINE 明細。
                </p>
              </div>

              <div className="rounded-xl border border-[#282E39] bg-[#111419] p-3.5">
                <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-amber-300">
                  <ShieldCheck className="h-4 w-4" />
                  物理限制優先原則
                </div>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  家具重排、風格轉換與單品合成皆將比例尺、<code className="text-slate-200">protectionZones</code>（窗戶／冷氣／配電箱）與屋主自訂約束共同傳遞至 Gemini 管線並進行工學幾何核對。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
