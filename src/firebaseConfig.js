// Cấu hình web app của project Firebase "coong". Đây không phải thông tin bí mật:
// quyền truy cập dữ liệu do firestore.rules quyết định.
export const firebaseConfig = {
  apiKey: 'AIzaSyCnOwzvBaYbpm32jqDevIjXEY6qR93Uq5Y',
  authDomain: 'coong-cafe.firebaseapp.com',
  projectId: 'coong-cafe',
  storageBucket: 'coong-cafe.firebasestorage.app',
  messagingSenderId: '383838678100',
  appId: '1:383838678100:web:60036cb5b12f2d985491c1',
  measurementId: 'G-FRP41XCBVK',
};

// Key "Web Push certificates" (Project settings → Cloud Messaging). Để trống thì tắt thông báo đẩy.
export const VAPID_KEY = '';
