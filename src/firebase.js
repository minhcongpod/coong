import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// Cấu hình web app của project Firebase "coong". Đây không phải thông tin bí mật:
// quyền truy cập dữ liệu do firestore.rules quyết định.
const firebaseConfig = {
  apiKey: 'AIzaSyDbiIjwVZmo0kDBmA7lrY0T3Yt_6Unfdqg',
  authDomain: 'coong-59ede.firebaseapp.com',
  projectId: 'coong-59ede',
  storageBucket: 'coong-59ede.firebasestorage.app',
  messagingSenderId: '119421794493',
  appId: '1:119421794493:web:1b2e8a9e95521f6559dfd4',
  measurementId: 'G-DM3QMETBFS',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Chạy với trình giả lập: VITE_USE_EMULATOR=1 npm run dev
if (import.meta.env.VITE_USE_EMULATOR) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
