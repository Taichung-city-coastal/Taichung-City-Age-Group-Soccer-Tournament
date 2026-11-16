# 115年臺中市分齡足球友誼賽暨國際足球邀請賽

直接開啟 index.html 即可瀏覽，不需要安裝套件或啟動伺服器。發佈時，將根目錄的八個 HTML、`css/site.css`、`css/theme-2026.css`、`js/site.js`、`js/announcements.js`、`主視覺.jpg`、`logo.jpg`、競賽章程 PDF 及 `assets/` 資料夾一併上傳。`範例/` 資料夾不屬於新網站。

本網站使用**獨立的樣式與腳本**：八個正式頁面載入 `css/site.css` 與 `css/theme-2026.css`，首頁與大會公告頁另載入 `js/announcements.js`；所有頁面均載入 `js/site.js`。不會讀取 `範例/` 下的任何 CSS、JavaScript 或外部共用檔案。

## GitHub Pages 發布
1. 使用新版 `GitHub-Pages-新版主視覺與FB公告.zip`，解壓縮後**上傳全部內容**，不要只上傳 ZIP 本身。舊的 `GitHub-Pages-完整發布版.zip` 是修改前的版本。
2. GitHub 儲存庫的 `main` 分支根目錄應直接看到 `index.html`、`css/`、`js/`、`assets/`、主視覺圖、Logo、各 HTML 頁面及章程 PDF。不要多包一層資料夾，也不要上傳 `範例/` 或 `.qa/`。
3. 到 GitHub 儲存庫 **Settings → Pages**，在 **Build and deployment** 選擇 **Deploy from a branch**，**main**、**/(root)**，並儲存。
4. 上傳完成後檢查瀏覽器開發者工具的 Network：`css/site.css`、`js/site.js` 與圖片應回傳 200，不應再出現 404；如仍看到舊畫面，請重新整理快取。

## 頁面
- index.html：主視覺、活動倒數、合併後的「大會最新消息與公告」（Facebook 貼文／章程／賽程）、會場介紹；主視覺下方三個單位 Logo 區域可點選前往各單位官方頁面
- announcements.html：Facebook 最新公告完整列表與賽務章程、賽程公告（已移除過期報名公告）
- event-info.html：活動流程、組別資格及報名資訊
- schedule.html：U6、U8、U10、U12、U15、成人組下拉選單
- regulations.html：章程重點、PDF 預覽／下載
- venue-map.html：活動會場與 Google 地圖查詢
- partners.html：依主視覺列示主辦、協辦與承辦單位；Logo 與名稱可開啟官方網站／Facebook
- about.html：獨立海線足球協會介紹

## 資料來源
賽事事實以原有「115年臺中市分齡足球友誼賽暨國際足球邀請賽1105 球隊公告版.pdf」六頁內容為依據。
2026-11-17 改用根目錄的 `主視覺.jpg`（包含主視覺與相關單位）。網站新增藍天、橘紅、草地綠配色；「相關單位」頁面的角色依新版主視覺列示：主辦單位臺中市政府、協辦單位臺中市政府運動局、承辦單位臺中市海線足球協會。既有運動局與協會 Logo 保留為本地素材，市政府以名稱標誌呈現。
協會介紹使用提供的原文，合併段落內的換行。
未取用範例的學童盃排名、日期、贊助商、報名費或賽程資料。

## 日期與待公告資訊
倒數起始為 2026-12-05T13:00:00+08:00；首週結束為 12/6 19:30，第二週開始為 12/12 13:00，活動結束為 12/13 20:30。時間以明確臺灣時區計算；階段結束會切換下一階段，最終歸零。
所有組別目前固定顯示「等待大會公告」，成人組依章程標明成人女子。
U6、U15 比賽時間未在該版章程列明；U10、U12 在 12/12 及 12/13 皆列有預／決賽，保留原表並註明個別場次待公告。
場地未擅自填入地址，地圖使用章程園區名稱搜尋。

## 維護
目前為純靜態網站，無後台、假比分或外部資料 API。
更新 Facebook 公告：編輯 `js/announcements.js` 最上方的 `announcements` 陣列。將新公告放在第一筆，填寫 `id`、`category`（標籤）、`title`（標題）、`description`（簡介）、`postUrl`（Facebook 貼文**公開的永久連結**）、`image`（貼文第一張照片的**本地相對路徑**，例如 `assets/announcements/xxx.jpg`）、`imageAlt`（圖片說明），`flag`（無圖片時的可選 emoji）。**首頁與「大會公告」會自動同步**；首頁最多顯示 3 筆，公告頁顯示全部。卡片點擊後開啟 Facebook 官方 `/plugins/post.php` 內嵌視窗，關閉視窗後停止載入 iframe，並保留「在 Facebook 開啟原文」備用連結。這是手動設定的公告列表，不會自動讀取整個 Facebook 粉絲專頁的新貼文。
Facebook 內嵌視窗支援響應式寬度：寬螢幕使用原生貼文寬度（最高 500px）；手機低於 Facebook 貼文可用的 350px 寬度時，會等比例縮小 iframe 並同步修正高度，不再出現橫向捲軸，僅在需要時保留垂直捲動。旋轉手機或調整視窗也會重新排版。
第一篇公告為「🔥 國際隊伍介紹｜香港熱火體育會 On Fire Athletic Association」，使用使用者提供的 `story_fbid=pfbid02QUQnzXSurMYzh3hJy6b3wabCc9JjYzvCzD87GpmpGxpP9kBgdrikeJos6Rcuxc2rl`、`id=61555701383095`。已從 Facebook 官方貼文內嵌 HTML 取得第一張圖片並下載為 `assets/announcements/on-fire-hong-kong-first.jpg`，公告卡片使用此本地 JPEG，不受 Facebook 暫時性圖片網址過期影響。Facebook 若因貼文權限、登入狀態或第三方嵌入限制未顯示內容，請使用原文連結；網站本身無法解除 Facebook 的限制。
更新賽務文字公告：編輯 `announcements.html` 下方「賽務資訊與提醒」及 `index.html` 的合併「大會最新消息與公告」區塊。過期報名消息已移除。
更新時程：同步修改 js/site.js 的 milestones 與 event-info.html 流程。
發布正式賽程時，再替換 schedule.html 的待公告區塊。
導航與頁尾直接寫入各 HTML；調整共同導航時請同步八頁。
所有核心圖片均為本機素材，無須外部字型或 CDN；只有 Facebook 貼文 iframe 需要連線與 Facebook 公開嵌入權限。
正式網站上線後可將 og:image（目前為 `主視覺.jpg`）改成正式站的完整絕對網址。

## 已完成驗證
- Windows Chrome 直接以 file:// 開啟：八頁在 390px 與 1440px 下無水平溢出；另檢查首頁、資訊、協會、賽程及單位頁 320px 版面。
- 首頁組別表單離線跳轉、六組選單、深層連結、無效組別回退、選單 Escape 關閉與焦點返回、倒數每秒更新均通過。
- 檢查 241 個本機資源與連結引用，無遺失檔案。
- 6 個倒數邊界情境通過：開始前、首週開始、週末間隔、第二週開始、結束與結束後，不會出現負數。
- 小字藍色與主要背景的對比已達一般文字 4.5:1 要求。

