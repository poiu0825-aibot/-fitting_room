# 本輪驗證

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
