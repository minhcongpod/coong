// Cấu hình web app của project Firebase "coong". Đây không phải thông tin bí mật:
// quyền truy cập dữ liệu do firestore.rules quyết định.
export const firebaseConfig = {
  apiKey: 'AIzaSyDbiIjwVZmo0kDBmA7lrY0T3Yt_6Unfdqg',
  authDomain: 'coong-59ede.firebaseapp.com',
  projectId: 'coong-59ede',
  storageBucket: 'coong-59ede.firebasestorage.app',
  messagingSenderId: '119421794493',
  appId: '1:119421794493:web:1b2e8a9e95521f6559dfd4',
  measurementId: 'G-DM3QMETBFS',
};

// Key "Web Push certificates" (Project settings → Cloud Messaging). Để trống thì tắt thông báo đẩy.
export const VAPID_KEY = '';
