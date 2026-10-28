import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { logger } from 'firebase-functions';

initializeApp();
const db = getFirestore();

// Trigger Firestore phải chạy cùng vùng với database (đã chọn asia-southeast1 khi tạo Firestore)
setGlobalOptions({ region: 'asia-southeast1', maxInstances: 2 });

const APP_URL = 'https://coong-59ede.web.app';

// Lỗi này nghĩa là token đã hết hạn hoặc người dùng gỡ app: xóa khỏi danh sách
const STALE_TOKEN_ERRORS = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

const sendToPhone = async (phone, title, body, link) => {
  const snap = await db.collection('pushTokens').where('phone', '==', phone).get();
  if (snap.empty) return;

  const tokens = snap.docs.map(d => d.id);
  const res = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    webpush: {
      notification: { icon: `${APP_URL}/icon-192.png`, badge: `${APP_URL}/icon-192.png`, tag: 'congca-order', renotify: true },
      fcmOptions: { link },
    },
  });

  const stale = res.responses
    .map((r, i) => (!r.success && STALE_TOKEN_ERRORS.has(r.error?.code) ? tokens[i] : null))
    .filter(Boolean);
  await Promise.all(stale.map(t => db.collection('pushTokens').doc(t).delete()));
  logger.info('push sent', { phone, success: res.successCount, failure: res.failureCount, removed: stale.length });
};

const describeItems = (items = []) => items.map(it => `${it.quantity}x ${it.name}`).join(', ');

// Khách đặt đơn: báo chủ quán
export const notifyNewOrder = onDocumentCreated('orders/{orderId}', async (event) => {
  const order = event.data?.data();
  if (!order) return;
  const setup = (await db.doc('meta/setup').get()).data();
  if (!setup?.adminPhone) return;
  await sendToPhone(
    setup.adminPhone,
    `🔔 Có đơn mới từ ${order.customerName}!`,
    `${describeItems(order.items)} · ${order.totalAmount.toLocaleString('vi-VN')}đ`,
    `${APP_URL}/?user=admin`,
  );
});

// Chủ quán chuyển đơn sang "Đã xong": báo khách
export const notifyOrderDone = onDocumentUpdated('orders/{orderId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after || before.status === after.status || after.status !== 'completed') return;
  await sendToPhone(
    after.customerPhone,
    '☕ Đồ uống của bạn đã pha xong!',
    describeItems(after.items),
    `${APP_URL}/?user=${after.customerPhone}`,
  );
});
