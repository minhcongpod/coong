// Báo hiệu khi app đang mở: chuông (Web Audio), rung, và thông báo hệ thống nếu được cấp quyền.
import { VAPID_KEY } from './firebaseConfig';

let audioCtx = null;

// Trình duyệt chỉ cho phát âm thanh sau khi người dùng chạm vào trang lần đầu
export const unlockAudio = () => {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* trình duyệt không hỗ trợ */ }
};

const playChime = () => {
  if (!audioCtx || audioCtx.state !== 'running') return;
  const start = audioCtx.currentTime;
  [880, 1175, 1568].forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = start + i * 0.18;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  });
};

export const notificationSupported = () => typeof window !== 'undefined' && 'Notification' in window;

export const notificationPermission = () => (notificationSupported() ? Notification.permission : 'unsupported');

export const requestNotificationPermission = async () => {
  if (!notificationSupported()) return 'unsupported';
  return Notification.requestPermission();
};

export const alertUser = (title, body) => {
  playChime();
  try { navigator.vibrate?.([200, 100, 200]); } catch { /* iOS không hỗ trợ rung */ }
  // Khi đã có thông báo đẩy, service worker lo phần hiển thị lúc app chạy nền, tránh báo trùng
  if (!VAPID_KEY && notificationPermission() === 'granted' && document.visibilityState !== 'visible') {
    try {
      new Notification(title, { body, icon: '/icon-192.png', tag: 'congca-order' });
    } catch { /* một số trình duyệt di động chỉ cho thông báo qua service worker */ }
  }
};
