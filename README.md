# Fitting Room / Local Virtual Try-On

以瀏覽器本機運算為核心的照片換髮型試用與基礎髮型／上衣 AR 疊圖。首頁預設照片流程；即時疊圖保留在「即時疊圖（基礎）」分頁。React + TypeScript + Vite，繁體中文、手機優先。無帳號、後端、資料庫、圖片上傳 API、雲端圖片儲存或遠端 AI API。

## 開發

需求：Node.js 24（`.nvmrc`）、npm、curl。相機需 HTTPS，或開發用的 localhost。使用現有 checkout；雲端任務已隔離，不需建立 Git worktree。

```sh
npm ci
npm run dev
```

`npm install` / `npm ci` 的 postinstall 會：

1. 用 esbuild 將追蹤 Worker 打包為 classic Worker。MediaPipe WASM loader 使用 `importScripts`，因此不能直接使用 module Worker。
2. 從鎖定的 npm 套件複製 MediaPipe WASM。
3. 透過 HTTPS 從 Google 官方版本化 URL 下載 Face Landmarker、Pose Landmarker Lite 與 Selfie Multiclass 分割模型，驗證固定 SHA-256。已有正確模型可離線重用。

所有執行時資源都在網站自己的 `/vision/`，不需要 CDN 或 AI 服務。`public/vision/` 是產生的靜態資源、不進 Git，建置會包含於 `dist/vision/`。初次安裝需要 `registry.npmjs.org` 與 `storage.googleapis.com`；安裝失敗不能略過模型就部署。npm 快取放在 `/tmp/fitting-room-npm-cache`，避免雲端 HOME 不可寫。

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

build 重新驗證模型並建立 Worker、typecheck、輸出完整靜態網站至 `dist/`。

## 照片換髮型（本機試用）

1. 用相機拍一張正面照片，或從本機選擇人像。拍照後相機停止，畫面凍結，沒有即時生成。
2. 選透明髮型 PNG / WEBP；也可選一張只有一人、正面的參考人像，讓本機模型擷取頭髮。
3. 檢查髮型預覽，在圖片或滑桿選擇髮際線中心；透明圖無法自動知道髮際線，這個錨點需要使用者確認。
4. 按「分析照片並合成」。可調位置、大小、旋轉、舊髮處理強度與新髮亮度，再切換原圖／結果檢查。
5. 下載 PNG，或清除本次圖片。離開照片流程或 reload 後，圖片、遮罩與結果會釋放。

照片分析使用官方 Selfie Multiclass 分割模型，在 classic Worker 中執行 IMAGE 模式，辨識 background / hair / body-skin / face-skin / clothes / accessories。模型 version 1，固定 SHA-256；約 16.4 MB，只在執行照片分析／參考人像擷取時載入。原圖長邊最多 1024 px，推論輸入長邊 768 px。所有資源從同源取得，不上傳照片。

舊髮補色採低解析度、保守的高信心 hair mask，將邻近背景色擴展入頭髮區域並平滑，最後只套回髮區。沒有背景可供補色時保留原像素並提示。以 face oval 保護眉眼以下的臉部與鬍鬚，另保護分割模型辨識的臉部／眼鏡／配件；額頭區域允許新瀏海。髮際線錨點取代舊的整張圖片中心定位；參考人像以臉寬估計比例，透明圖需要確認錨點並微調。

**這是照片合成試用，不是已達成寫實 AI 換髮型。** 本機補色不會生成被遮住的真實背景或頭皮；複雜背景、長髮改短髮、低光、細髮絲、帽子、眼鏡與不匹配的參考角度仍可能失敗或留下痕跡。大角度側臉與多人會拒絕合成，且無法保証自動對齊任意透明髮型圖。請使用正面、簡單背景照片，檢查原圖／結果後再下載。實體手機品質需使用者驗收，不應把模型／功能測試通過當作寫實品質通過。

新增模組：`src/photo/photo.worker.ts`、`analyser.ts`、`composition.ts`、`pixels.ts`、`usePhotoStudio.ts`、`types.ts`、`config.ts`，介面在 `src/components/PhotoStudio.tsx`。`PHOTO_CONFIG` 集中推論尺寸、mask 門檻、側臉限制、時間與錨點預設。

## 即時疊圖功能與使用

1. 先切換「即時疊圖（基礎）」，再按「開啟相機」，允許前鏡頭。可隨時關閉或重新啟動，不會自動索取權限。
2. 選「髮型」或「上衣」，從手機相簿／檔案選一張 PNG、JPG、WEBP（最大 15 MB）。透明背景效果最佳。Alpha 保留；JPG 不會自動去背。
3. 髮型模式請讓一張臉正面入鏡；上衣模式請讓肩膀與腰部都入鏡。
4. 用大小、上下、左右、旋轉微調，各模式的圖片與校正值獨立。可重設或移除圖片。
5. 按「拍下這個樣子」檢查結果，按「儲存圖片」下載 PNG。下載完成不會自動刪除預覽；關閉預覽會釋放其 Object URL。
6. 重新整理會清除上傳圖片與拍照结果，並關閉相機。

`?mode=live&debug=1` 顯示 FPS、推論 FPS、來源／Canvas 解析度、臉部數量、姿態狀態、臉部中心、最後 transform、鏡像狀態，以及畫面上的 landmarks。預設關閉。拍照不包含 debug 或 UI。

## 架構與主要檔案

```text
src/
  app/App.tsx                   組合 UI 與 hooks，無推論／繪圖細節
  components/                   相機、模式、上傳、校正、拍照、狀態、Debug UI
  hooks/useCamera.ts            權限、stream、取消請求、重啟與卸載清理
  hooks/useUploadedAsset.ts     各模式記憶體資源及替換／解碼競態處理
  hooks/useVision.ts            Worker 管理、限頻、單一 in-flight frame
  hooks/useTryOnEngine.ts       rAF 渲染、transform、tracking expiry、拍照
  vision/vision.worker.ts       MediaPipe 在另一執行緒推論
  vision/faceLandmarker.ts       Face 模型選項
  vision/poseLandmarker.ts       Pose 模型選項
  vision/transforms.ts           raw landmarks → FaceTransform / PoseTransform
  vision/smoothing.ts            時間感知 EMA、最短路徑角度平滑
  vision/types.ts                資產、追蹤、校正、Worker protocol 型別
  renderer/coordinateUtils.ts   集中座標映射、object-cover 裁切、鏡像、DPR
  renderer/overlayTransform.ts   自動髮型／上衣 transform 與校正合併
  renderer/*Renderer.ts         共用 Canvas drawImage 渲染
  renderer/compositor.ts        鏡像 camera + overlay，同時用於預覽和拍照
  services/imageLoader.ts       本機解碼、尺寸限制、EXIF orientation、縮圖
  services/assetProcessor.ts    未來 browser-only removeBackground interface
  services/imageExporter.ts    toBlob 與本機下載
  config/tryOnConfig.ts          比例、限頻、平滑、過期與資源限制
  styles/main.css               手機／橫式／桌面介面
scripts/                        Worker 打包與經校驗的模型準備
public/_headers                 Cloudflare Pages 隱私與安全 response headers
tests/                          幾何、平滑、錯誤、合成及瀏覽器測試
.github/workflows/ci.yml         無實體 webcam 的 CI
```

依賴：React / React DOM、`@mediapipe/tasks-vision` 0.10.32。開發工具：TypeScript、Vite、React plugin、esbuild、ESLint、Vitest、Playwright。`package-lock.json` 固定解析版本。

## Face / Pose、座標與效能

- Face：Face Landmarker VIDEO 模式、CPU delegate、最多兩張臉。使用 234/454、10/152、33/263 等 landmarks 取得臉中心、寬高、眼距、頭部傾斜與尺度。只有一張臉時才套用髮型，兩張以上會隱藏疊圖並提示。
- Pose：Pose Landmarker Lite VIDEO 模式，使用 11/12 肩膀與 23/24 髖部（visibility 門檻 0.5）取得軀幹中心、肩寬、軀幹高度、肩線旋轉。上衣依肩寬縮放，保留原始圖片比例。
- Renderer 僅接受 `TryOnTransform`，不讀 raw landmarks。自動定位先做 EMA，再合併使用者校正，沒有修改 landmarks。
- normalized coordinates 經來源尺寸、cover 比例與裁切偏移映射到 CSS pixels；鏡像只在 `coordinateUtils.ts` 中計算。相機畫面也由此繪製，無其他 CSS `scaleX(-1)`。DPR 僅用於 Canvas backing store，避免重複縮放。
- 鏡像後再算眼線／肩線角度，保持正確傾斜方向；以無向直線處理端點順序，避免 180° 翻轉。
- 校正左右／上下用 CSS px，大小為倍數，旋轉用 radians。方向／視窗尺寸變更時重新映射並清除舊座標的平滑值。
- requestAnimationFrame 使用最新 transform 繪製；推論在 classic Worker，最多一張待處理 ImageBitmap。傳入寬度上限 640，臉部目標 24 FPS／Pose 15 FPS，頁面隱藏時停止送 frame。模型與記憶體在切換模式／相機停止時釋放。
- 預設 EMA time constant 85 ms；追蹤超過 450 ms 無更新即隱藏 overlay。模型或 Worker 失敗可重試，camera preview 仍可顯示。

## 拍照與隱私

拍照建立一張新 Canvas，用相同 `compositor` 合成當下 video frame 與最後有效的疊圖，再 `canvas.toBlob('image/png')`。尺寸／裁切／鏡像与預覽相同，沒有 OS screenshot，也不會包含 debug、滑桿或介面。

圖片由 File → ImageBitmap 在裝置解碼。長邊超過 2048 會在本機縮圖；超過 4000 萬像素的圖會拒絕（解碼後才能取得解析度，極大圖片仍可能造成裝置記憶體壓力）。替換與卸載會 `.close()` 舊 ImageBitmap。拍照預覽的 Object URL 會在關閉或卸載時撤銷。

不使用 localStorage、IndexedDB、service worker、cookies、analytics 或圖片紀錄。沒有 fetch POST、WebSocket、遠端人物分析與 Base64／影像 console logging。執行時網路請求只取得同源靜態網站／模型／WASM；官方模型下載只發生於開發建置，沒有夾帶使用者影像。Cloudflare Pages 的一般靜態存取紀錄仍由 hosting 平台處理，但應用程式沒有上傳使用者影像。

`public/_headers` 限制 connect-src 與 Worker 到同源、僅允許本站相機、關閉麥克風／地理定位權限、停用 referrer、禁止被 iframe 嵌入。請勿在部署站點額外啟用影像分析或第三方追蹤 scripts。

## 自動測試

```sh
npm test
npx playwright install --with-deps chromium
npm run test:browser
# 已先 build 時，可另外驗證正式輸出與 Cloudflare CSP：
PLAYWRIGHT_SERVER_MODE=preview npm run test:browser
```

雲端若已安裝 Chromium，可避免再次下載：

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:browser
```

- Vitest：座標裁切、mirror、反向轉換、resize、角度、EMA、FaceTransform、GarmentTransform、Calibration merge、相機錯誤與鏡像合成。
- Playwright：手機 UI、圖片上傳、校正／重設／模式隔離、session 清除、權限拒絕、fake camera、合成 PNG／下載、關閉 stream、無對外資料傳送。
- 真實模型在 Worker 中初始化並推論空白 frame；不需要 CI webcam。
- 可額外以 `VISION_TEST_FACE_IMAGE`、`VISION_TEST_POSE_IMAGE` 提供放在 Git 外的官方範例 JPG，驗證真實臉部與人體偵測。照片流程另有官方人像擷取／合成／下載測試，同樣可用 `VISION_TEST_FACE_IMAGE` 啟用。未提供時這三個測試會明確 skip，其他模型初始化測試仍必須通過。不提交測試人像或自拍。

本次開發驗證結果在 `docs/validation.md`，記錄成功的命令、範圍與真機限制。

## 手機真機測試與相容性

目標：最新版 Android Chrome、iOS Safari 17+（需支援 OffscreenCanvas、ImageBitmap、WebAssembly 與 Worker WebGL）。Desktop Chrome 亦可測試。舊版 iOS、內嵌瀏覽器與禁用 WebGL 的裝置可能無法追蹤，請改用最新版 Safari／Chrome；介面會顯示可理解的错误。**尚未在實體 iPhone／Android 完成驗收，不能視為已證明全裝置相容。**

1. 用 Cloudflare Pages HTTPS 預覽網址開啟手機網站（LAN 的 HTTP IP 不屬於 secure context）。
2. 相機未開啟時重新整理，確認不會自動要求權限。按開啟、拒絕，驗證提示；再至網站權限允許並重試。
3. 開啟前鏡頭，比對鏡像文字方向。上傳透明髮型 PNG，左右移動、靠近／遠離、左右傾頭，觀察位置、大小與傾斜方向。測試 1／2 人入鏡及離開畫面，overlay 應依狀態隱藏。
4. 測試每個 slider 與重設；旋轉手機與調整視窗後不應出現座標漂移。
5. 切換上衣，讓肩膀與髖部入鏡；上傳上衣圖，微調後確認肩線跟隨、比例保留、低可見度時隱藏。
6. 拍照，比對預覽裁切、mirror、髮型／上衣位置；下載並從相簿／檔案開啟。iOS 下載可能進入「檔案」或瀏覽器下載介面，依 OS 流程保存。
7. 用 `?debug=1` 查看 FPS 與 landmarks；確認截圖不含 debug。測試低光、背景、眼鏡、低階裝置與其他 app 佔用鏡頭。
8. 關閉／重新啟動相機，切換前景／背景、離開頁面、重新整理，確認相機釋放且 session 資產不跨 reload 保留。檢查 DevTools Network 沒有影像 POST／遠端分析。

## Cloudflare Pages（僅靜態）

不需 Worker、R2、D1、Cloudflare API key 或任何 secret 即可建置。

Pages → 建立專案 → Connect to Git → 選此 repository：

| 設定                   | 值                      |
| ---------------------- | ----------------------- |
| Production branch      | 合併 PR 後的 `main`     |
| Preview branch         | `codex/local-tryon-mvp` |
| Framework              | Vite                    |
| Build command          | `npm run build`         |
| Build output directory | `dist`                  |
| Root directory         | repository root         |
| Node version           | 24.19.0（`.nvmrc`）     |

平台安裝 dependencies 時會執行 postinstall；確保 build environment 可下載 Google 官方模型，並保留 TLS 與 SHA-256 驗證。完整輸出包含模型、WASM、classic Worker 與 `_headers`。Cloudflare 正式網址自帶 HTTPS，camera permission 才能正常要求。發佈後檢查 `/vision/face_landmarker.task`、`/vision/pose_landmarker_lite.task`、`/vision/vision.worker.js` 與 WASM 路徑回傳正常；再依真機清單驗收。此開發任務不會自動部署網站。

## 已知限制與下一階段

這是 2D AR overlay，不是真實 AI Virtual Try-On。圖片沒有語意錨點，每張髮型／上衣需要人工微調；無自動去背、材質變形、yaw／pitch 3D 透視、手臂遮擋、分割或布料物理。上衣需肩膀與髖部完整可見，寬鬆衣服／遮挡／低光可能讓追蹤不穩。下載圖片只含目前 preview cover 裁切範圍，不是完整相機來源。

手機效能與發熱依裝置而異，開發環境觀察到的 FPS 不能保證手機同樣達成。下一階段最值得優先做 **真機品質驗收＋圖片錨點校正**，再改善 Pose 可見度與自適應推論限頻。之後才考慮 mesh warp、手臂分割及遮擋；遠端 AI 不是基本 AR 必要條件。

## 官方參考

- [MediaPipe Face Landmarker Web](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js)
- [MediaPipe Pose Landmarker Web](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js)

官方文件提醒 `detectForVideo` 同步阻塞呼叫執行緒，因此本專案將它放在 Worker。

照片測試包含分割 Worker 真實初始化／推論、沒有臉時拒絕合成、原圖／結果／下載、透明留白裁切、分割誤判鬍鬚為頭髮時保護臉部，以及相機拒絕後改選本機照片。模型與所有測試人像不進 Git。

照片分割官方參考：[Image Segmenter／Multi-class selfie model](https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter#multiclass-model)。
