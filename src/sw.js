// Service worker nhận thông báo đẩy khi app đã tắt. Được build riêng thành
// /firebase-messaging-sw.js (xem vite.sw.config.js). Thông báo có trường
// "notification" nên Firebase SDK tự hiển thị và tự mở link khi bấm vào.
import { initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging/sw';
import { firebaseConfig } from './firebaseConfig';

initializeApp(firebaseConfig);
getMessaging();

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
