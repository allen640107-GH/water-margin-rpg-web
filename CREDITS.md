# 素材與授權

- **美術**：所有背景、人物、行走圖、戰鬥立繪、建築、地表貼圖、物件圖片均由 Grok Imagine 生成（水墨風），經 `tools/process_art.py`、`tools/process_sprites.py` 轉為 WebP（`img/`）。原始高解析度檔保留於 `art/src/`，遊戲執行時不會載入。
- **影片**：片頭與標題循環影片由 Grok Imagine 生成，以 ffmpeg 壓縮為 `media/*.mp4`。
- **音樂與音效**：全部以 Web Audio API 即時合成（`js/audio.js`），無外部音檔。
- **字型**：標題字型為 Noto Serif CJK TC（Bold）子集（`fonts/title.woff2`，由 `tools/make_font.py` 產生），依 SIL Open Font License 1.1 授權。內文使用系統字型。
- **故事**：改編自施耐庵《水滸傳》（公有領域），對白為本作重新撰寫。
- 程式碼：本專案原創。不使用任何外部服務、追蹤或付費 API。
