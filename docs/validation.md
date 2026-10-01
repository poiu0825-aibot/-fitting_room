# 驗證記錄

## 原即時 MVP（歷史）

執行環境：Linux 雲端、Node 24.19.0、npm 11.9.0、系統 Chromium。測試皆為開發任務當次結果，不能推論已在實體 iOS／Android 或 Cloudflare 發佈後驗證。

- `npm install`：初次遇到 HOME cache 不可寫，改用 repository `.npmrc` 的 `/tmp` 快取。
- 模型下載：初次 proxy HTTP 403，加入 Google 官方網域並待規則生效後下載成功。模型來自官方 HTTPS，固定 SHA-256；沒有略過 TLS、checksum 或換成非官方模型。
- `npm run typecheck`、`npm run lint`、`npm test`、`npm run build`：通過；Vitest 24 tests／3 files。完整 build 包含經 SHA-256 校驗的模型、WASM 與 Worker。
- 正式輸出瀏覽器測試：8 tests 全部通過（無 skip），包含 Cloudflare `_headers` CSP、真實模型初始化及官方圖片偵測。一般 CI 未提供官方圖片時只 skip 那兩項圖片偵測，仍會驗證模型初始化、相機流程與 CSP。
- Browser：使用本機 fake camera，真實 Face／Pose 模型都在 classic Worker 初始化並推論；額外下載官方 `mediapipe-assets/portrait.jpg` 與 `pose.jpg` 到 `/tmp`，驗證實際人物偵測。這些人像沒有加入 Git。
- UI：檢查 390×844 手機 layout 截圖，沒有水平 overflow，校正與相機介面分開。
- 性能抽樣：Desktop Chromium fake camera，1280×720 相機來源、463×618 canvas，觀察 render 約 60 FPS、Face inference 約 20 FPS。這不是手機效能承諾。
- 隱私：瀏覽器測試確認只有同源靜態 GET 與本機 blob 預覽；沒有影像 POST 或遠端 AI 請求。

尚未驗證：實體手機相機、各手機的 mirror／EXIF 行為與下載 UX、長時間熱節流、已部署 Cloudflare Pages 網站。請依 README 真機流程完成確認。

## 本機照片換髮型試用

- Node／系統 Chromium 環境同上。`npm run lint`、`npm run typecheck`、`npm test`、`npm run build` 通過，Vitest 30 tests／4 files。
- 正式输出 Playwright 15 tests：14 passed、1 skipped。跳過的是未提供 `VISION_TEST_POSE_IMAGE` 的既有官方人體圖片測試；真實 Pose 初始化仍執行並通過。
- 本次提供 `/tmp` 官方 portrait fixture，真實 Face 偵測、照片版分割、參考人像頭髮擷取、合成、前後對照及 PNG 下載通過。這不是將任意兩張人像合成後的寫實品質評測。
- 另以可控 Worker 遮罩將臉部誤標為頭髮，實際走 UI 合成並驗證下半臉像素保持原值、額頭新髮確實套用；不是只測 renderer 假呼叫。
- 未偵測到人臉時不產生假成功結果；單元測試拒絕多人／大角度側臉。相機拒絕後可改選本機人像。
- production `_headers` CSP 已涵蓋 live 與 photo 流程的模型、WASM、Blob 預覽與錨點調整；沒有對外圖像 POST。
- Selfie Multiclass model version 1 從官方 HTTPS 下載，SHA-256 固定 `c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0`。約 16.4 MB，最大的單一部署檔案；model、WASM、影像、結果皆不進 Git。
- 檢視桌面與 390×844 手機 UI 截圖，沒有水平 overflow。官方測試人像與衍生結果僅在 ignored 測試輸出／tmp。

品質限制：只有本機分割與近似背景補色，沒有生成式 inpainting、隱藏頭皮重建或 3D 頭髮。灰白髮與原髮色差異、複雜背景、長髮改短髮、髮絲與眼鏡遮擋仍需真機與原始髮型 PNG 品質驗收。不能宣稱自然換髮型已普遍達到寫實效果；介面與 README 均標示試用及限制。
