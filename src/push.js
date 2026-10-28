import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { app, auth, db } from './firebase';
import { VAPID_KEY } from './firebaseConfig';

// Đăng ký thiết bị nhận thông báo đẩy khi app đã tắt (cần đã cấp quyền Notification).
// Token lưu ở pushTokens/{token}; Cloud Functions dùng nó để gửi thông báo theo SĐT.
export const registerPush = async (phone) => {
  if (!VAPID_KEY || import.meta.env.DEV) return false;
  if (!(await isSupported()) || Notification.permission !== 'granted') return false;

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  if (!token) return false;

  await setDoc(doc(db, 'pushTokens', token), {
    phone,
    uid: auth.currentUser?.uid || null,
    userAgent: navigator.userAgent.slice(0, 200),
    updatedAt: new Date().toISOString(),
  });
  return true;
};

export const isIosBrowser = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.matchMedia('(display-mode: standalone)').matches;
