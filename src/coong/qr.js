// Mã VietQR (chuẩn EMVCo/NAPAS) cho tài khoản của quán, kèm số tiền và nội dung chuyển khoản.
import qrcode from 'qrcode-generator';

// Techcombank (BIN 970407), số tài khoản 8456777999: lấy từ mã QR tĩnh của quán trong Figma
const MERCHANT = '0010A0000007270124000697040701108456777999' + '0208QRIBFTTA';

const tlv = (id, v) => id + String(v.length).padStart(2, '0') + v;

function crc16(s) {
  let c = 0xffff;
  for (const ch of s) {
    c ^= ch.charCodeAt(0) << 8;
    for (let i = 0; i < 8; i++) c = (c & 0x8000 ? (c << 1) ^ 0x1021 : c << 1) & 0xffff;
  }
  return c.toString(16).toUpperCase().padStart(4, '0');
}

/** Nội dung VietQR: có số tiền thì là mã động (010212), không thì mã tĩnh */
export function vietQR(amount, note) {
  let p = tlv('00', '01') + tlv('01', amount ? '12' : '11') + tlv('38', MERCHANT) + tlv('53', '704');
  if (amount) p += tlv('54', String(Math.round(amount)));
  p += tlv('58', 'VN');
  if (note) p += tlv('62', tlv('08', note));
  p += '6304';
  return p + crc16(p);
}

/** Ma trận ô đen/trắng của mã QR */
export function qrMatrix(text) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  const n = q.getModuleCount();
  return { n, dark: (x, y) => q.isDark(y, x) };
}
