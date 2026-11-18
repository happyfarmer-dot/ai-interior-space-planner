# 空間智繪 SpatialMind AI — 室內空間設計與裝潢物理輔助系統

具備「空間物理邏輯」與「商業落地參考價值」的 AI 室內空間設計與裝潢輔助應用程式，結合空間尺度校準、動線人體工學檢測、不可更動結構保護、光影色溫模擬、局部材質替換與台灣市場預算估算。

## 核心與進階功能模組（11 大模組）

1. **現有傢俱智慧重排（Smart Furniture Rearrangement）**：不更換現有家具，依據採光、通風與保護遮罩生成 2～3 組最佳配置與 2D 俯視平面圖。
2. **多元風格轉換（Style Transfer & Rendering）**：內建北歐簡約、日式侘寂、現代極簡、工業風、無印原木風、美式輕奢，支援 0%～100% 風格強度與 Before/After 滑桿對比。
3. **新增物件智慧擺放（New Object Smart Placement）**：支援單品去背演算法、真實尺寸輸入，自動標示 1～3 個建議高亮擺放區並依透視合成。
4. **客製化裝潢需求解析（Custom Design Prompt & Constraints）**：快速標籤＋自然語言解析為結構化 JSON 約束條件，貫穿後續配置與預算警戒。
5. **空間尺度校準（Spatial Scale Calibration）**：支援房門 210cm / 插座 12cm / A4 / 60cm 地磚等基準線段拉線校準 `Pixel-to-CM` 與 3D 透視網格。
6. **動線淨寬與人體工學檢測（Traffic Flow & Ergonomics Check）**：紅／黃／綠燈即時檢測主走道淨寬（≥75cm / <60cm 警告）、門片開啟半徑衝突、視聽距離與建議電視吋數。
7. **不可更動結構與機電點位鎖定（Structural & MEP Protection Mask）**：筆刷／多邊形遮罩鎖定樑柱、採光窗、冷氣出風口、總配電箱與插座，禁止 AI 違規遮擋。
8. **自然採光與人工照明色溫模擬（Lighting & Color Temperature）**：切換東向晨光／西曬午後／北向柔和光／夜間模式、`3000K / 4000K / 6000K` 色溫、無主燈嵌燈與間接燈帶。
9. **局部材質精準替換（Local Material Inpainting）**：針對地板、主牆面、沙發布料、窗簾局部替換超耐磨木地板、微水泥、藝術礦物漆、貓抓布等材質。
10. **軟裝單品以圖搜物推薦（Visual Search & Product Matching）**：框選軟裝並比對 IKEA、MUJI 無印良品、NITORI 宜得利、MR. LIVING 居家先生商品規格與售價。
11. **粗估工程與軟裝物料清單（BOM & Rough Budget Estimator）**：差異比對計算坪數／件數與台灣市場行情區間，並支援匯出 Print-Ready PDF 設計企劃書、CSV 與 JSON。

## 系統目錄結構

```text
ai-interior-space-planner/
├── .env.example                     # VLM / Diffusion / LLM API 端點與金鑰環境變數範本
├── .github/workflows/deploy.yml     # GitHub Pages 自動化部署流程
├── public/samples/                  # 預設台灣住宅客廳／臥室／軟裝單品範例影像
└── src/
    ├── types/design.ts              # 11 大模組完整 TypeScript 型別定義
    ├── data/                        # 風格庫、建材庫、台灣家居規格資料庫、範例空間
    ├── services/                    # AI Pipeline 服務抽象層 (Hybrid Mock + Live API)
    ├── store/                       # Undo / Redo 狀態管理與版本快照 (Version History)
    ├── utils/                       # 幾何碰撞、人體工學、BOM 計算與 Canvas 影像處理
    └── components/                  # 主畫布視口、2D 平面圖、四步驟控制面板與報表彈窗
```

## 本地開發與 API 整合

```bash
npm install
npm run dev
```

若需串接真實外部付費 API（OpenAI Vision / Replicate ControlNet Inpainting / LLM），請複製 `.env.example` 為 `.env.local` 並設定 `VITE_AI_MODE=live` 與對應金鑰。
