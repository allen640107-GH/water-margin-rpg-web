# 素材與授權

- **美術**：所有背景、人物、敵人、物件圖片均由 Grok Imagine 生成（水墨風），經 `tools/process_art.py` 轉為 WebP。原始檔不含於部署中。
- **音樂與音效**：全部以 Web Audio API 即時合成（`js/audio.js`），無外部音檔。
- **字型**：標題字型為 Noto Serif CJK TC（Bold）子集（`fonts/title.woff2`，由 `tools/make_font.py` 產生），依 SIL Open Font License 1.1 授權。內文使用系統字型。
- **故事**：改編自施耐庵《水滸傳》（公有領域），對白為本作重新撰寫。
- 程式碼：本專案原創。不使用任何外部服務、追蹤或付費 API。
