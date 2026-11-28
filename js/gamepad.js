// 家用主機手把直連支援（Web Gamepad API：PS5 DualSense / Xbox / Switch Pro 手把隨插即玩）
// 支援類比左搖桿（含死區）、十字鍵、A 確認／調查、B 疾走／取消、X 開選單／切換自動戰鬥、Start 選單
const DEADZONE = 0.26;
let prevBtns = [];
let connectedNotified = false;

export function pollGamepad(handlers) {
  if (!navigator.getGamepads) return { dir: null, sprint: false };
  const pads = navigator.getGamepads();
  let gp = null;
  for (let i = 0; i < pads.length; i++) {
    if (pads[i] && pads[i].connected) { gp = pads[i]; break; }
  }
  if (!gp) { prevBtns = []; return { dir: null, sprint: false }; }

  if (!connectedNotified) {
    connectedNotified = true;
    handlers.onConnect && handlers.onConnect(gp.id);
  }

  const down = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
  const just = (i) => down(i) && !prevBtns[i];

  // 1) 左搖桿＋十字鍵方向判定
  let dir = null;
  const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
  if (down(12) || ay < -DEADZONE && Math.abs(ay) >= Math.abs(ax)) dir = 0;      // 上
  else if (down(15) || ax > DEADZONE && Math.abs(ax) > Math.abs(ay)) dir = 1;  // 右
  else if (down(13) || ay > DEADZONE && Math.abs(ay) >= Math.abs(ax)) dir = 2; // 下
  else if (down(14) || ax < -DEADZONE && Math.abs(ax) > Math.abs(ay)) dir = 3; // 左

  // 2) 主機按鍵邊緣觸發
  if (just(0)) handlers.onConfirm && handlers.onConfirm();     // A / ✕：對話推進、調查、確認
  if (just(1)) handlers.onCancel && handlers.onCancel();       // B / ○：返回、取消自動戰鬥
  if (just(2)) handlers.onAutoOrAlt && handlers.onAutoOrAlt(); // X / □：切換自動戰鬥
  if (just(9) || just(3)) handlers.onMenu && handlers.onMenu();// Start / Y：開關選單

  const sprint = down(1) || down(4) || down(5); // 按住 B / L1 / R1 疾走！
  prevBtns = gp.buttons.map(b => !!b.pressed);
  return { dir, sprint };
}
