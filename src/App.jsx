import React, { useState, useEffect, useRef } from 'react';
import {
  Coffee, History, BarChart3, Wallet, User, Users,
  Trash2, Plus, Edit, X, LogOut, Lock, Search, Copy, KeyRound, Bell, BellOff
} from 'lucide-react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth } from './firebase';
import {
  getSetup, bootstrapAdmin, getUser, watchDevice, unlockDevice, lockDevice,
  watchMenu, watchOrders, watchTransactions, watchUsers, watchUser,
  saveMenuItem, deleteMenuItem, seedMenu, createOrder, updateOrder,
  addTransaction, deleteTransaction, collectDebt,
  createCustomer, updateUserName, setPin as savePin, deleteCustomer,
} from './db';
import { unlockAudio, alertUser, notificationPermission, requestNotificationPermission } from './notify';
import { registerPush, isIosBrowser } from './push';

// --- INITIAL MOCK DATA ---
const INITIAL_MENU = [
  { id: '1', name: 'Cà phê Đen', price: 25000, cost: 8000, active: true, image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=300' },
  { id: '2', name: 'Cà phê Nâu', price: 30000, cost: 10000, active: true, image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=300' },
  { id: '3', name: 'Bạc xỉu', price: 35000, cost: 12000, active: true, image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=300' },
];


const STATUS_LABELS = {
  pending: 'Chờ xử lý',
  brewing: 'Đang pha...',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy ❌',
};

const STATUS_STYLES = {
  pending: 'bg-slate-700/60 text-slate-300',
  brewing: 'bg-amber-500/20 text-amber-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  cancelled: 'bg-rose-900/40 text-rose-400',
};

const shortId = (id) => id.slice(-6).toUpperCase();

const getTimestamp = (record) => (record.createdAt ? new Date(record.createdAt).getTime() : null);

const formatDateTime = (record) => {
  if (!record.createdAt) return record.time || record.date || '';
  return new Date(record.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
};

// Mốc bắt đầu của kỳ báo cáo: hôm nay / tuần từ thứ Hai / đầu tháng / đầu năm
const getPeriodStart = (period) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  if (period === 'month') d.setDate(1);
  if (period === 'year') d.setMonth(0, 1);
  return d.getTime();
};

const inPeriod = (record, period) => {
  const ts = getTimestamp(record);
  return ts !== null && ts >= getPeriodStart(period);
};

const itemsCost = (items) => items.reduce((sum, it) => sum + (it.cost || 0) * (it.quantity || 1), 0);

const LAST_PHONE_KEY = 'coffee_last_phone';

const readLastPhone = () => {
  try { return localStorage.getItem(LAST_PHONE_KEY); } catch { return null; }
};

const saveLastPhone = (phone) => {
  try { localStorage.setItem(LAST_PHONE_KEY, phone); } catch { /* bỏ qua chế độ ẩn danh */ }
};

const showError = (err) => {
  console.error(err);
  window.alert(`Có lỗi khi lưu dữ liệu: ${err.code || err.message}`);
};

function CenteredCard({ children }) {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 text-white rounded-2xl p-6 w-full max-w-md shadow-xl text-center">
        {children}
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
      <Lock className="w-8 h-8" />
    </div>
  );
}

export default function App() {
  // stage: loading | error | setup | phone | locked | ready
  const [stage, setStage] = useState('loading');
  const [errorText, setErrorText] = useState('');
  const [uid, setUid] = useState(null);
  const [phone, setPhone] = useState(null);
  const [profile, setProfile] = useState(null);
  const [device, setDevice] = useState(undefined);

  // 1. Đăng nhập ẩn danh, đọc cấu hình quán và SĐT đã đăng nhập trên máy này
  useEffect(() => {
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        signInAnonymously(auth).catch((err) => { setErrorText(err.code || err.message); setStage('error'); });
        return;
      }
      try {
        const setup = await getSetup();
        if (cancelled) return;
        setUid(user.uid);
        if (!setup) return setStage('setup');

        const target = readLastPhone();
        if (!target) return setStage('phone');

        const found = await getUser(target);
        if (cancelled) return;
        if (!found) return setStage('phone');
        saveLastPhone(target);
        setPhone(target);
        setProfile(found);
      } catch (err) {
        setErrorText(err.code || err.message);
        setStage('error');
      }
    });
    return () => { cancelled = true; unsub(); };
  }, []);

  // 2. Theo dõi thiết bị này đã mở khóa cho SĐT nào
  useEffect(() => {
    if (!uid || !phone || !profile) return;
    return watchDevice(uid, setDevice, (err) => { setErrorText(err.code); setStage('error'); });
  }, [uid, phone, profile]);

  useEffect(() => {
    if (device === undefined || !profile) return;
    setStage(device && device.phone === phone ? 'ready' : 'locked');
  }, [device, phone, profile]);

  const handleUnlock = async (pin) => {
    // Thiết bị đang mở khóa cho SĐT khác thì khóa lại trước
    if (device) await lockDevice(uid);
    await unlockDevice(uid, phone, pin);
  };

  const handleLock = () => lockDevice(uid).catch(showError);

  // Khách mở link gốc: nhập SĐT, tìm tài khoản rồi sang màn PIN
  const handlePhone = async (target) => {
    const found = await getUser(target);
    if (!found) return false;
    saveLastPhone(target);
    setDevice(undefined);
    setPhone(target);
    setProfile(found);
    return true;
  };

  const handleOtherPhone = () => {
    setProfile(null);
    setPhone(null);
    setDevice(undefined);
    setStage('phone');
  };

  if (stage === 'loading') {
    return (
      <CenteredCard>
        <Coffee className="w-10 h-10 text-amber-500 mx-auto mb-3 animate-pulse" />
        <p className="text-slate-400 text-sm">Đang kết nối...</p>
      </CenteredCard>
    );
  }

  if (stage === 'error') {
    return (
      <CenteredCard>
        <h1 className="text-lg font-bold mb-2">Không kết nối được</h1>
        <p className="text-slate-400 text-sm mb-4">Vui lòng kiểm tra mạng và thử lại.</p>
        <p className="text-[11px] text-slate-500 mb-4">Mã lỗi: {errorText}</p>
        <button onClick={() => window.location.reload()} className="w-full bg-amber-500 text-slate-950 font-semibold py-3 rounded-xl">Thử lại</button>
      </CenteredCard>
    );
  }

  if (stage === 'setup') return <SetupScreen uid={uid} />;

  if (stage === 'phone') return <PhoneScreen onSubmit={handlePhone} />;

  if (stage === 'locked') return <PinScreen profile={profile} onUnlock={handleUnlock} onOtherPhone={handleOtherPhone} />;

  return <MainApp phone={phone} onLock={handleLock} />;
}

function SetupScreen({ uid }) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('Chủ Quán');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!/^\d{9,11}$/.test(phone)) return setError('SĐT chủ quán phải gồm 9 đến 11 chữ số.');
    if (!/^\d{4}$/.test(pin)) return setError('Mã PIN phải gồm đúng 4 chữ số.');
    setSaving(true);
    try {
      await bootstrapAdmin(uid, { phone, name: name.trim() || 'Chủ Quán', pin });
      saveLastPhone(phone);
      window.location.reload();
    } catch (err) {
      setSaving(false);
      setError(`Không thiết lập được: ${err.code || err.message}`);
    }
  };

  const inputClass = 'w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500';

  return (
    <CenteredCard>
      <Coffee className="w-10 h-10 text-amber-500 mx-auto mb-3" />
      <h1 className="text-xl font-bold mb-1">Thiết lập quán lần đầu</h1>
      <p className="text-slate-400 text-sm mb-5">Tạo tài khoản chủ quán. Bước này chỉ làm một lần duy nhất.</p>
      <form onSubmit={handleSubmit} className="space-y-3 text-left">
        <div>
          <label className="text-xs text-slate-400 block mb-1">SĐT chủ quán</label>
          <input type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} className={inputClass} />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Tên hiển thị</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Mã PIN chủ quán (4 số)</label>
          <input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} className={inputClass} />
        </div>
        {error && <p className="text-rose-400 text-xs">{error}</p>}
        <button type="submit" disabled={saving} className="w-full bg-amber-500 text-slate-950 font-semibold py-3 rounded-xl disabled:opacity-60">
          {saving ? 'Đang lưu...' : 'Tạo tài khoản chủ quán'}
        </button>
      </form>
    </CenteredCard>
  );
}

function PhoneScreen({ onSubmit }) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!/^\d{9,11}$/.test(phone)) return setError('Số điện thoại gồm 9 đến 11 chữ số.');
    setChecking(true);
    try {
      if (!(await onSubmit(phone))) {
        setError('Số này chưa có tài khoản. Vui lòng liên hệ chủ quán để được tạo.');
        setChecking(false);
      }
    } catch (err) {
      setError(`Lỗi: ${err.code || err.message}`);
      setChecking(false);
    }
  };

  return (
    <CenteredCard>
      <Coffee className="w-10 h-10 text-amber-500 mx-auto mb-3" />
      <h1 className="text-xl font-bold mb-1">CongCa Coffee</h1>
      <p className="text-slate-400 text-sm mb-6">Nhập số điện thoại để đặt món.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="tel"
          inputMode="numeric"
          autoFocus
          placeholder="Số điện thoại"
          value={phone}
          onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '')); setError(''); }}
          className="w-full text-center text-xl tracking-wider bg-slate-900 border border-slate-700 rounded-xl py-3 text-white focus:outline-none focus:border-amber-500"
        />
        {error && <p className="text-rose-400 text-xs">{error}</p>}
        <button
          type="submit"
          disabled={checking}
          className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold py-3 rounded-xl transition-all disabled:opacity-60"
        >
          {checking ? 'Đang kiểm tra...' : 'Tiếp tục'}
        </button>
      </form>
    </CenteredCard>
  );
}

function PinScreen({ profile, onUnlock, onOtherPhone }) {
  const [inputPin, setInputPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [checking, setChecking] = useState(false);

  const handleVerifyPin = async (e) => {
    e.preventDefault();
    if (inputPin.length !== 4) return setPinError('Mã PIN gồm 4 chữ số.');
    setChecking(true);
    try {
      await onUnlock(inputPin);
    } catch (err) {
      setPinError(err.code === 'permission-denied' ? 'Mã PIN không đúng!' : `Lỗi: ${err.code || err.message}`);
      setInputPin('');
      setChecking(false);
    }
  };

  return (
    <CenteredCard>
      <LockIcon />
      <h1 className="text-xl font-bold mb-1">Xác thực Quyền truy cập</h1>
      <p className="text-slate-400 text-sm mb-6">Xin chào {profile.name}! Vui lòng nhập mã PIN để tiếp tục.</p>

      <form onSubmit={handleVerifyPin} className="space-y-4">
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          autoFocus
          placeholder="Nhập mã PIN (4 số)"
          value={inputPin}
          onChange={(e) => setInputPin(e.target.value.replace(/\D/g, ''))}
          className="w-full text-center text-2xl tracking-widest bg-slate-900 border border-slate-700 rounded-xl py-3 text-white focus:outline-none focus:border-amber-500"
        />
        {pinError && <p className="text-rose-400 text-xs">{pinError}</p>}
        <button
          type="submit"
          disabled={checking}
          className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold py-3 rounded-xl transition-all disabled:opacity-60"
        >
          {checking ? 'Đang kiểm tra...' : 'Mở khóa'}
        </button>
      </form>

      <div className="mt-6 pt-4 border-t border-slate-700/50 text-xs text-slate-500">
        Mã PIN mặc định là 4 số cuối SĐT của bạn.
        <button type="button" onClick={onOtherPhone} className="block mx-auto mt-3 text-amber-500 font-semibold">Dùng số khác</button>
      </div>
    </CenteredCard>
  );
}

// Sau khi mở khóa: tải dữ liệu realtime theo vai trò
function MainApp({ phone, onLock }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [menu, setMenu] = useState([]);
  const [orders, setOrders] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [users, setUsers] = useState({});

  const [toast, setToast] = useState(null);
  const [permission, setPermission] = useState(notificationPermission());
  // Trạng thái đơn ở lần cập nhật trước; null = chưa nhận lần đầu (không báo đơn cũ)
  const prevStatusRef = useRef(null);

  useEffect(() => watchUser(phone, setCurrentUser, showError), [phone]);

  const isAdmin = currentUser?.role === 'admin';

  // Âm thanh chỉ phát được sau lần chạm đầu tiên vào trang
  useEffect(() => {
    window.addEventListener('pointerdown', unlockAudio);
    return () => window.removeEventListener('pointerdown', unlockAudio);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Số đơn chờ hiện trên tiêu đề tab
  useEffect(() => {
    const pending = isAdmin ? orders.filter(o => o.status === 'pending').length : 0;
    document.title = pending ? `(${pending}) CongCa Coffee` : 'CongCa Coffee';
  }, [orders, isAdmin]);

  const handleOrdersUpdate = (list) => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = Object.fromEntries(list.map(o => [o.id, o.status]));
    setOrders(list);
    if (!prev) return;

    if (isAdmin) {
      const fresh = list.filter(o => !(o.id in prev) && o.status === 'pending');
      if (fresh.length) {
        const first = fresh[0];
        const body = `${first.customerName}: ${first.items.map(it => `${it.quantity}x ${it.name}`).join(', ')}`;
        alertUser('🔔 Có đơn mới!', body);
        setToast({ title: fresh.length > 1 ? `🔔 Có ${fresh.length} đơn mới!` : '🔔 Có đơn mới!', body });
      }
    } else {
      const done = list.find(o => o.status === 'completed' && prev[o.id] && prev[o.id] !== 'completed');
      if (done) {
        alertUser('☕ Đồ uống đã pha xong!', 'Mời bạn ra lấy nhé.');
        setToast({ title: '☕ Đồ uống đã pha xong!', body: 'Mời bạn ra lấy nhé.' });
      }
    }
  };

  const handleEnableNotifications = async () => {
    unlockAudio();
    if (permission === 'unsupported') {
      window.alert(isIosBrowser()
        ? 'Trên iPhone: bấm nút Chia sẻ của Safari → "Thêm vào MH chính", rồi mở app từ màn hình chính và bấm "Bật thông báo".'
        : 'Trình duyệt này không hỗ trợ thông báo.');
      return;
    }
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === 'granted') registerPush(phone).catch(err => console.error('push', err));
  };

  // Đã cấp quyền từ trước: làm mới token mỗi lần mở app
  useEffect(() => {
    if (currentUser && permission === 'granted') registerPush(phone).catch(err => console.error('push', err));
  }, [phone, !!currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    prevStatusRef.current = null;
    const unsubs = [
      watchMenu(setMenu, showError),
      watchOrders(phone, isAdmin, handleOrdersUpdate, showError),
    ];
    if (isAdmin) {
      unsubs.push(watchTransactions(setTransactions, showError));
      unsubs.push(watchUsers(setUsers, showError));
    }
    return () => unsubs.forEach(u => u());
  }, [phone, isAdmin, !!currentUser]);

  if (!currentUser) {
    return (
      <CenteredCard>
        <Coffee className="w-10 h-10 text-amber-500 mx-auto mb-3 animate-pulse" />
        <p className="text-slate-400 text-sm">Đang tải dữ liệu...</p>
      </CenteredCard>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="bg-slate-900/80 border-b border-slate-800 px-4 py-3 sticky top-0 z-40 backdrop-blur-md flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="bg-amber-500/20 p-2 rounded-lg border border-amber-500/30">
            <Coffee className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <span className="font-bold text-base text-slate-100 block leading-tight">CongCa Coffee</span>
            <span className="text-[10px] text-amber-400 font-medium uppercase tracking-wider">
              {isAdmin ? 'Quyền Chủ Quán' : `Khách: ${currentUser.name}`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(permission === 'default' || (permission === 'unsupported' && isIosBrowser())) && (
            <button
              onClick={handleEnableNotifications}
              className="text-amber-400 p-2 rounded-lg bg-amber-500/10 text-xs flex items-center gap-1 border border-amber-500/30"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Bật thông báo</span>
            </button>
          )}
          {permission === 'denied' && (
            <span title="Thông báo đang bị chặn trong cài đặt trình duyệt" className="text-slate-500 p-2">
              <BellOff className="w-3.5 h-3.5" />
            </span>
          )}
          <button
            onClick={onLock}
            className="text-slate-400 hover:text-rose-400 p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-xs flex items-center gap-1 border border-slate-700/50"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Khóa</span>
          </button>
        </div>
      </header>

      {toast && (
        <button
          onClick={() => setToast(null)}
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md bg-amber-500 text-slate-950 rounded-xl p-3 shadow-2xl text-left"
        >
          <span className="font-bold block text-sm">{toast.title}</span>
          <span className="text-xs">{toast.body}</span>
        </button>
      )}

      <main className="flex-1 max-w-2xl w-full mx-auto p-4 pb-24">
        {isAdmin ? (
          <AdminDashboard menu={menu} orders={orders} transactions={transactions} users={users} />
        ) : (
          <CustomerDashboard currentUser={currentUser} menu={menu} orders={orders} />
        )}
      </main>
    </div>
  );
}

// ADMIN DASHBOARD
function AdminDashboard({ menu, orders, transactions, users }) {
  const [activeTab, setActiveTab] = useState('orders');
  const pendingCount = orders.filter(o => o.status === 'pending').length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
        {[
          { id: 'orders', label: 'Đơn hàng', icon: History, badge: pendingCount },
          { id: 'menu', label: 'Menu', icon: Coffee },
          { id: 'customers', label: 'Khách', icon: Users },
          { id: 'reports', label: 'Báo cáo', icon: BarChart3 },
          { id: 'wallet', label: 'Thu Chi', icon: Wallet },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex flex-col items-center justify-center py-2 rounded-lg text-[11px] font-medium transition-all ${
                isActive ? 'bg-amber-500 text-slate-950 font-bold shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4 mb-1" />
              <span>{tab.label}</span>
              {tab.badge > 0 && (
                <span className="absolute top-0.5 right-1 bg-rose-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === 'menu' && <AdminMenuTab menu={menu} />}
      {activeTab === 'orders' && <AdminOrdersTab orders={orders} />}
      {activeTab === 'customers' && <AdminCustomersTab users={users} orders={orders} />}
      {activeTab === 'reports' && <AdminReportsTab orders={orders} transactions={transactions} />}
      {activeTab === 'wallet' && <AdminWalletTab transactions={transactions} orders={orders} users={users} />}
    </div>
  );
}

function AdminMenuTab({ menu }) {
  // null: đóng form, {}: thêm món mới, item: sửa món
  const [editingItem, setEditingItem] = useState(null);

  const toggleActive = (item) => {
    saveMenuItem({ id: item.id, active: !item.active }).catch(showError);
  };

  const handleSave = async ({ id, name, price, cost, image }) => {
    try {
      await saveMenuItem({ id, name, price, cost, image });
      setEditingItem(null);
    } catch (err) {
      showError(err);
    }
  };

  const handleDelete = (item) => {
    if (!window.confirm(`Xóa món "${item.name}" khỏi menu?`)) return;
    deleteMenuItem(item.id).catch(showError);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-amber-500">Quản lý Menu món</h2>
        <button
          onClick={() => setEditingItem({})}
          className="bg-amber-500 text-slate-950 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> Thêm món mới
        </button>
      </div>

      <div className="space-y-3">
        {menu.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-sm space-y-3">
            <p>Menu đang trống.</p>
            <button onClick={() => seedMenu(INITIAL_MENU).catch(showError)} className="bg-slate-800 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs">
              Thêm 3 món mẫu
            </button>
          </div>
        )}
        {menu.map((item) => (
          <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex gap-3 items-center">
            {item.image ? (
              <img src={item.image} alt={item.name} className="w-16 h-16 rounded-lg object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-slate-800 flex items-center justify-center">
                <Coffee className="w-6 h-6 text-slate-600" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start gap-2">
                <h3 className="font-bold text-slate-100 truncate">{item.name}</h3>
                <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold ${item.active ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500'}`}>
                  {item.active ? 'Đang bán' : 'Hết hàng'}
                </span>
              </div>
              <p className="text-xs text-amber-400 font-semibold mt-1">{item.price.toLocaleString()}đ <span className="text-slate-500 font-normal">(Vốn: {item.cost.toLocaleString()}đ)</span></p>
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => toggleActive(item)} className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:text-white text-xs">
                {item.active ? 'Ẩn' : 'Hiện'}
              </button>
              <div className="flex gap-1">
                <button onClick={() => setEditingItem(item)} className="p-1 rounded bg-slate-800 text-slate-300 hover:text-amber-400" aria-label="Sửa món">
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(item)} className="p-1 rounded bg-slate-800 text-slate-300 hover:text-rose-400" aria-label="Xóa món">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editingItem && (
        <MenuItemForm item={editingItem} onClose={() => setEditingItem(null)} onSave={handleSave} />
      )}
    </div>
  );
}

function MenuItemForm({ item, onClose, onSave }) {
  const [name, setName] = useState(item.name || '');
  const [price, setPrice] = useState(item.price ?? '');
  const [cost, setCost] = useState(item.cost ?? '');
  const [image, setImage] = useState(item.image || '');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('Vui lòng nhập tên món.');
    if (!(Number(price) > 0)) return setError('Giá bán phải lớn hơn 0.');
    if (Number(cost) < 0) return setError('Giá vốn không được âm.');
    onSave({ ...item, name: name.trim(), price: Number(price), cost: Number(cost) || 0, image: image.trim() });
  };

  const inputClass = 'w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-amber-500';

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 w-full max-w-sm space-y-3">
        <h3 className="font-bold text-amber-500">{item.id ? 'Sửa món' : 'Thêm món mới'}</h3>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Tên món</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Giá bán (đ)</label>
            <input type="number" inputMode="numeric" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Giá vốn (đ)</label>
            <input type="number" inputMode="numeric" min="0" value={cost} onChange={(e) => setCost(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Link ảnh (không bắt buộc)</label>
          <input type="url" value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://..." className={inputClass} />
        </div>
        {error && <p className="text-rose-400 text-xs">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2 text-xs bg-slate-800 text-slate-400 rounded-lg">Hủy</button>
          <button type="submit" className="flex-1 py-2 text-xs bg-amber-500 text-slate-950 font-bold rounded-lg">Lưu món</button>
        </div>
      </form>
    </div>
  );
}

function AdminOrdersTab({ orders }) {
  const [statusFilter, setStatusFilter] = useState('active');

  const updateOrderStatus = (orderId, newStatus) => {
    updateOrder(orderId, { status: newStatus }).catch(showError);
  };

  const togglePayment = (order) => {
    updateOrder(order.id, { paid: !order.paid }).catch(showError);
  };

  const filteredOrders = orders.filter(o => {
    if (statusFilter === 'active') return o.status === 'pending' || o.status === 'brewing';
    if (statusFilter === 'unpaid') return !o.paid && o.status !== 'cancelled';
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-amber-500">Quản lý Đơn hàng</h2>
        <div className="flex gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
          {[['active', 'Đang làm'], ['unpaid', 'Chưa trả'], ['all', 'Tất cả']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-2 py-1 text-xs rounded ${statusFilter === key ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {filteredOrders.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">Không có đơn hàng nào.</div>
      ) : (
        filteredOrders.map((order) => (
          <div key={order.id} className={`bg-slate-900 border rounded-xl p-4 space-y-3 ${order.status === 'cancelled' ? 'border-rose-900/50 opacity-60' : 'border-slate-800'}`}>
            <div className="flex justify-between items-start border-b border-slate-800 pb-2">
              <div>
                <span className="font-bold text-slate-100">{order.customerName}</span>
                <span className="text-xs text-slate-500 block">{formatDateTime(order)} · #{shortId(order.id)}</span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <select
                  value={order.status}
                  onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                  className="bg-slate-800 text-xs border border-slate-700 text-slate-200 rounded px-2 py-1 focus:outline-none"
                >
                  <option value="pending">Chờ xử lý</option>
                  <option value="brewing">Đang pha</option>
                  <option value="completed">Đã xong</option>
                  <option value="cancelled">Đã HỦY ❌</option>
                </select>

                {order.status !== 'cancelled' && (
                  <button
                    onClick={() => togglePayment(order)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      order.paid
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    {order.paid ? 'Đã Thanh Toán' : 'Ghi Nợ'}
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1">
              {order.items.map((it, idx) => (
                <div key={idx} className="text-xs flex justify-between text-slate-300">
                  <span>{it.quantity}x {it.name} ({it.sweetness}, {it.ice}, {it.caffeine})</span>
                  <span className="font-semibold">{(it.price * it.quantity).toLocaleString()}đ</span>
                </div>
              ))}
              {order.note && <p className="text-xs italic text-amber-400/80 bg-amber-950/20 p-2 rounded mt-1">Ghi chú: {order.note}</p>}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-800/60">
              <span className="text-xs text-slate-400">Tổng cộng:</span>
              <span className="font-bold text-amber-500">{order.totalAmount.toLocaleString()}đ</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function AdminCustomersTab({ users, orders }) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const customers = Object.values(users)
    .filter(u => u.role === 'customer')
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

  const debtOf = (p) => orders
    .filter(o => o.customerPhone === p && !o.paid && o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  // Khách nào cũng dùng chung link gốc, vào bằng SĐT + PIN
  const appLink = `${window.location.origin}/`;

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!/^\d{9,11}$/.test(phone)) return setError('SĐT phải gồm 9 đến 11 chữ số.');
    if (users[phone]) return setError('SĐT này đã có trong danh sách.');
    try {
      await createCustomer({ phone, name: name.trim() || `Khách (${phone.slice(-4)})`, pin: phone.slice(-4) });
      setPhone('');
      setName('');
      setError('');
    } catch (err) {
      setError(`Không thêm được: ${err.code || err.message}`);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(appLink);
      setCopied('app');
      setTimeout(() => setCopied(''), 2000);
    } catch {
      window.prompt('Copy đường link này gửi cho khách:', appLink);
    }
  };

  const handleResetPin = (u) => {
    if (!window.confirm(`Đặt lại PIN của ${u.name} về 4 số cuối SĐT (${u.phone.slice(-4)})?`)) return;
    savePin(u.phone, u.phone.slice(-4)).catch(showError);
  };

  const handleDelete = (u) => {
    if (debtOf(u.phone) > 0) return window.alert('Khách này còn nợ, hãy thu nợ trước khi xóa.');
    if (!window.confirm(`Xóa khách ${u.name}? Khách sẽ không đăng nhập được nữa.`)) return;
    deleteCustomer(u.phone).catch(showError);
  };

  const inputClass = 'w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-amber-500';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-2">
        <h2 className="text-lg font-bold text-amber-500">Khách hàng</h2>
        <button onClick={handleCopy} className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:text-amber-400 flex items-center gap-1 text-xs">
          <Copy className="w-3.5 h-3.5" /> {copied === 'app' ? 'Đã copy' : 'Link app khách'}
        </button>
      </div>

      <form onSubmit={handleAdd} className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input type="tel" inputMode="numeric" placeholder="SĐT khách" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} className={inputClass} />
          <input type="text" placeholder="Tên hiển thị" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        {error && <p className="text-rose-400 text-xs">{error}</p>}
        <button type="submit" className="w-full bg-amber-500 text-slate-950 font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1">
          <Plus className="w-4 h-4" /> Thêm khách (PIN mặc định = 4 số cuối SĐT)
        </button>
      </form>

      <div className="space-y-2">
        {customers.length === 0 && <div className="text-center py-6 text-slate-500 text-xs">Chưa có khách nào.</div>}
        {customers.map((u) => {
          const debt = debtOf(u.phone);
          return (
            <div key={u.phone} className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex justify-between items-center gap-2 text-xs">
              <div className="min-w-0">
                <span className="font-semibold block text-slate-200 truncate">{u.name}</span>
                <span className="text-[10px] text-slate-500">{u.phone}</span>
                {debt > 0 && <span className="text-[10px] text-rose-400 font-semibold ml-2">Nợ {debt.toLocaleString()}đ</span>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleResetPin(u)} className="p-1.5 rounded bg-slate-800 text-slate-300 hover:text-amber-400" aria-label="Đặt lại PIN">
                  <KeyRound className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(u)} className="p-1.5 rounded bg-slate-800 text-slate-300 hover:text-rose-400" aria-label="Xóa khách">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const PERIOD_LABELS = { day: 'Ngày', week: 'Tuần', month: 'Tháng', year: 'Năm' };

function AdminReportsTab({ orders, transactions }) {
  const [filter, setFilter] = useState('day');

  const periodOrders = orders.filter(o => o.status !== 'cancelled' && inPeriod(o, filter));
  const periodTx = transactions.filter(t => inPeriod(t, filter));

  const totalOrders = periodOrders.length;
  const totalRevenue = periodOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalCogs = periodOrders.reduce((sum, o) => sum + itemsCost(o.items), 0);
  const grossProfit = totalRevenue - totalCogs;
  const totalExpense = periodTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = periodTx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  // Lợi nhuận ròng = doanh thu bán hàng − các khoản chi thực tế trong sổ thu chi
  const netProfit = totalRevenue - totalExpense;
  // Công nợ là số dư hiện tại, không phụ thuộc kỳ lọc
  const totalDebt = orders.filter(o => o.status !== 'cancelled' && !o.paid).reduce((sum, o) => sum + o.totalAmount, 0);
  const legacyCount = orders.filter(o => !o.createdAt).length;

  const cards = [
    { label: 'Số đơn (không tính hủy)', value: totalOrders, color: 'text-white', raw: true },
    { label: 'Doanh thu', value: totalRevenue, color: 'text-white' },
    { label: 'Giá vốn món đã bán', value: totalCogs, color: 'text-slate-300' },
    { label: 'Lãi gộp (theo giá vốn)', value: grossProfit, color: 'text-emerald-400' },
    { label: 'Tổng Chi (sổ thu chi)', value: totalExpense, color: 'text-amber-400' },
    { label: 'Lợi nhuận Ròng', value: netProfit, color: netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400' },
    { label: 'Tiền mặt thu vào', value: totalIncome, color: 'text-sky-400' },
    { label: 'Công nợ khách (hiện tại)', value: totalDebt, color: 'text-rose-400' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-amber-500">Báo cáo Doanh thu</h2>
        <div className="flex gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
          {Object.entries(PERIOD_LABELS).map(([f, label]) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 text-xs rounded ${filter === f ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
            <span className="text-xs text-slate-400 block">{c.label}</span>
            <span className={`text-xl font-bold mt-1 block ${c.color}`}>{c.raw ? c.value : `${c.value.toLocaleString()}đ`}</span>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-slate-500 leading-relaxed">
        Lợi nhuận ròng = Doanh thu − Tổng chi trong sổ thu chi. Lãi gộp dùng giá vốn khai báo cho từng món, để tham khảo.
        {legacyCount > 0 && ` Có ${legacyCount} đơn cũ không có ngày nên không được tính vào báo cáo theo kỳ.`}
      </p>
    </div>
  );
}

function AdminWalletTab({ transactions, orders, users }) {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [quickCategory, setQuickCategory] = useState('');
  const [debtorPhone, setDebtorPhone] = useState('');
  const [search, setSearch] = useState('');
  const [listFilter, setListFilter] = useState('all');

  const QUICK_EXPENSES = ['Cà phê', 'Sữa tươi', 'Sữa đặc', 'Cốc & Nắp', 'Ống hút', 'Khác'];

  // Danh sách khách đang nợ, để thu nợ và gạch nợ luôn các đơn
  const debtors = Object.values(
    orders
      .filter(o => !o.paid && o.status !== 'cancelled')
      .reduce((acc, o) => {
        const entry = acc[o.customerPhone] || { phone: o.customerPhone, name: users[o.customerPhone]?.name || o.customerName, total: 0, count: 0 };
        entry.total += o.totalAmount;
        entry.count += 1;
        acc[o.customerPhone] = entry;
        return acc;
      }, {})
  );
  const selectedDebtor = debtors.find(d => d.phone === debtorPhone);

  const resetForm = () => {
    setAmount('');
    setDescription('');
    setQuickCategory('');
    setDebtorPhone('');
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!(Number(amount) > 0)) return;

    try {
      await addTransaction({
        type,
        amount: Number(amount),
        description: quickCategory ? `[${quickCategory}] ${description}`.trim() : description,
      });
      resetForm();
    } catch (err) {
      showError(err);
    }
  };

  const handleCollectDebt = async () => {
    if (!selectedDebtor) return;
    if (!window.confirm(`Thu đủ ${selectedDebtor.total.toLocaleString()}đ của ${selectedDebtor.name} và đánh dấu ${selectedDebtor.count} đơn là đã thanh toán?`)) return;

    const orderIds = orders
      .filter(o => o.customerPhone === selectedDebtor.phone && !o.paid && o.status !== 'cancelled')
      .map(o => o.id);
    try {
      await collectDebt(orderIds, {
        type: 'income',
        amount: selectedDebtor.total,
        description: `[Thu nợ] ${selectedDebtor.name} (${selectedDebtor.count} đơn)`,
        customerPhone: selectedDebtor.phone,
      });
      resetForm();
    } catch (err) {
      showError(err);
    }
  };

  const handleDelete = (tx) => {
    if (!window.confirm(`Xóa giao dịch "${tx.description || 'Giao dịch'}"?`)) return;
    deleteTransaction(tx.id).catch(showError);
  };

  const keyword = search.trim().toLowerCase();
  const visibleTx = transactions.filter(t =>
    (listFilter === 'all' || t.type === listFilter) &&
    (!keyword || (t.description || '').toLowerCase().includes(keyword))
  );
  const visibleTotal = visibleTx.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-amber-500">Sổ Thu Chi / Ví Quán</h2>

      <form onSubmit={handleAdd} className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg border ${type === 'expense' ? 'bg-rose-500/20 text-rose-400 border-rose-500' : 'bg-slate-800 border-transparent text-slate-400'}`}
          >
            Chi ra (-)
          </button>
          <button
            type="button"
            onClick={() => setType('income')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg border ${type === 'income' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500' : 'bg-slate-800 border-transparent text-slate-400'}`}
          >
            Thu vào (+)
          </button>
        </div>

        {type === 'expense' && (
          <div className="flex flex-wrap gap-1">
            {QUICK_EXPENSES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setQuickCategory(quickCategory === cat ? '' : cat)}
                className={`text-[10px] px-2 py-1 rounded border ${quickCategory === cat ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {type === 'income' && debtors.length > 0 && (
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-2 space-y-2">
            <label className="text-[11px] text-slate-400 block">Thu nợ khách (gạch nợ luôn các đơn):</label>
            <select
              value={debtorPhone}
              onChange={(e) => setDebtorPhone(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none"
            >
              <option value="">-- Chọn khách đang nợ --</option>
              {debtors.map(d => (
                <option key={d.phone} value={d.phone}>{d.name}: {d.total.toLocaleString()}đ ({d.count} đơn)</option>
              ))}
            </select>
            {selectedDebtor && (
              <button type="button" onClick={handleCollectDebt} className="w-full bg-emerald-500 text-slate-950 font-bold py-2 rounded-lg text-xs">
                Thu đủ {selectedDebtor.total.toLocaleString()}đ
              </button>
            )}
          </div>
        )}

        <input
          type="number"
          inputMode="numeric"
          min="0"
          placeholder="Số tiền (VNĐ)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none"
        />

        <input
          type="text"
          placeholder={type === 'income' ? "Tên người trả tiền mặt..." : "Mô tả chi tiết..."}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none"
        />

        <button type="submit" className="w-full bg-amber-500 text-slate-950 font-bold py-2 rounded-lg text-xs">
          Lưu khoản {type === 'income' ? 'Thu' : 'Chi'}
        </button>
      </form>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lịch sử Giao dịch</h3>
          <span className={`text-xs font-bold ${visibleTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {visibleTotal >= 0 ? '+' : ''}{visibleTotal.toLocaleString()}đ
          </span>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-2">
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Tìm theo mô tả, tên..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent py-1.5 text-xs text-white focus:outline-none"
            />
          </div>
          <div className="flex gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            {[['all', 'Tất cả'], ['income', 'Thu'], ['expense', 'Chi']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setListFilter(key)}
                className={`px-2 py-1 text-xs rounded ${listFilter === key ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {visibleTx.length === 0 && <div className="text-center py-6 text-slate-500 text-xs">Không có giao dịch nào.</div>}
        {visibleTx.map((tx) => (
          <div key={tx.id} className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex justify-between items-center gap-2 text-xs">
            <div className="min-w-0">
              <span className="font-semibold block text-slate-200 truncate">{tx.description || 'Giao dịch'}</span>
              <span className="text-[10px] text-slate-500">{formatDateTime(tx)}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`font-bold ${tx.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {tx.type === 'income' ? '+' : '-'}{tx.amount.toLocaleString()}đ
              </span>
              <button onClick={() => handleDelete(tx)} className="text-slate-500 hover:text-rose-400 p-1" aria-label="Xóa giao dịch">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// CUSTOMER DASHBOARD
function CustomerDashboard({ currentUser, menu, orders }) {
  const [activeTab, setActiveTab] = useState('menu');
  const [cart, setCart] = useState([]);
  const [note, setNote] = useState('');

  // orders đã được lọc theo khách ở tầng dữ liệu
  const myOrders = orders;
  const unpaidOrders = myOrders.filter(o => !o.paid && o.status !== 'cancelled');
  const debtTotal = unpaidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  const [placing, setPlacing] = useState(false);

  const addToCart = (item, options) => {
    setCart([...cart, {
      menuId: item.id, name: item.name, price: item.price, cost: item.cost || 0,
      ...options, cartId: `${Date.now()}${Math.random()}`,
    }]);
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0 || placing) return;

    setPlacing(true);
    try {
      await createOrder({
        customerPhone: currentUser.phone,
        customerName: currentUser.name,
        items: cart.map(({ cartId, ...it }) => it),
        note,
        totalAmount: cart.reduce((sum, i) => sum + (i.price * (i.quantity || 1)), 0),
        status: 'pending',
        paid: false,
      });
      setCart([]);
      setNote('');
      setActiveTab('history');
    } catch (err) {
      showError(err);
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="space-y-4">
      {debtTotal > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl flex justify-between items-center text-xs">
          <span className="text-rose-300">Số dư nợ chưa thanh toán:</span>
          <span className="font-bold text-rose-400 text-sm">{debtTotal.toLocaleString()}đ ({unpaidOrders.length} đơn)</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
        {[
          { id: 'menu', label: 'Menu Đặt hàng', icon: Coffee },
          { id: 'history', label: 'Lịch sử Đơn', icon: History },
          { id: 'profile', label: 'Tài khoản', icon: User },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center py-2 rounded-lg text-xs font-medium ${
                activeTab === tab.id ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4 mb-1" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'menu' && (
        <CustomerMenuTab 
          menu={menu} cart={cart} setCart={setCart} 
          addToCart={addToCart} onPlaceOrder={handlePlaceOrder} placing={placing}
          note={note} setNote={setNote}
        />
      )}
      {activeTab === 'history' && <CustomerHistoryTab orders={myOrders} />}
      {activeTab === 'profile' && <CustomerProfileTab currentUser={currentUser} />}
    </div>
  );
}

function CustomerMenuTab({ menu, cart, setCart, addToCart, onPlaceOrder, placing, note, setNote }) {
  const [selectedItem, setSelectedItem] = useState(null);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        {menu.filter(m => m.active).map((item) => (
          <div key={item.id} className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex gap-3 items-center">
            <img src={item.image} alt={item.name} className="w-20 h-20 rounded-lg object-cover" />
            <div className="flex-1">
              <h3 className="font-bold text-slate-100">{item.name}</h3>
              <span className="text-amber-500 font-bold text-sm block mt-1">{item.price.toLocaleString()}đ</span>
            </div>
            <button
              onClick={() => setSelectedItem(item)}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-3 py-1.5 rounded-lg text-xs font-bold"
            >
              Chọn món
            </button>
          </div>
        ))}
      </div>

      {selectedItem && (
        <OrderItemModal 
          item={selectedItem} 
          onClose={() => setSelectedItem(null)} 
          onAdd={(opts) => { addToCart(selectedItem, opts); setSelectedItem(null); }}
        />
      )}

      {cart.length > 0 && (
        <div className="bg-slate-900 border border-amber-500/40 p-4 rounded-xl space-y-3 shadow-2xl">
          <h3 className="font-bold text-amber-500 text-sm">Giỏ hàng của bạn ({cart.length} món)</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {cart.map((c) => (
              <div key={c.cartId} className="text-xs flex justify-between items-center text-slate-300 border-b border-slate-800 pb-1">
                <span>{c.quantity}x {c.name} ({c.sweetness}, {c.ice}, {c.caffeine})</span>
                <button onClick={() => setCart(cart.filter(i => i.cartId !== c.cartId))} className="text-rose-400 p-1">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <input
            type="text"
            placeholder="Ghi chú cho quán (ít đá, nhiều sữa...)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full bg-slate-800 text-xs p-2 rounded border border-slate-700 text-white focus:outline-none"
          />

          <button
            onClick={onPlaceOrder}
            disabled={placing}
            className="w-full bg-amber-500 text-slate-950 font-bold py-2.5 rounded-lg text-sm shadow-lg disabled:opacity-60"
          >
            {placing ? 'Đang gửi... ' : 'Gửi Đặt Hàng '} ({cart.reduce((s, i) => s + (i.price * i.quantity), 0).toLocaleString()}đ)
          </button>
        </div>
      )}
    </div>
  );
}

function OrderItemModal({ item, onClose, onAdd }) {
  const [sweetness, setSweetness] = useState('Vừa');
  const [ice, setIce] = useState('Đá');
  const [caffeine, setCaffeine] = useState('Thường');
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 w-full max-w-sm space-y-4">
        <h3 className="font-bold text-amber-500">{item.name}</h3>

        <div>
          <label className="text-xs text-slate-400 block mb-1">Độ ngọt:</label>
          <div className="grid grid-cols-3 gap-1">
            {['Ít ngọt', 'Vừa', 'Ngọt nhiều'].map(s => (
              <button key={s} onClick={() => setSweetness(s)} className={`py-1 text-xs rounded border ${sweetness === s ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1">Lượng đá:</label>
          <div className="grid grid-cols-3 gap-1">
            {['Không đá', 'Ít đá', 'Đá'].map(i => (
              <button key={i} onClick={() => setIce(i)} className={`py-1 text-xs rounded border ${ice === i ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                {i}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1">Caffeine:</label>
          <div className="grid grid-cols-2 gap-1">
            {['Thường', 'Đậm đà'].map(c => (
              <button key={c} onClick={() => setCaffeine(c)} className={`py-1 text-xs rounded border ${caffeine === c ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center pt-2">
          <span className="text-xs text-slate-400">Số lượng:</span>
          <div className="flex items-center gap-3 bg-slate-800 px-3 py-1 rounded-lg">
            <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="text-amber-500 font-bold text-base">-</button>
            <span className="font-bold text-sm text-white">{quantity}</span>
            <button onClick={() => setQuantity(quantity + 1)} className="text-amber-500 font-bold text-base">+</button>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2 text-xs bg-slate-800 text-slate-400 rounded-lg">Hủy</button>
          <button onClick={() => onAdd({ sweetness, ice, caffeine, quantity })} className="flex-1 py-2 text-xs bg-amber-500 text-slate-950 font-bold rounded-lg">
            Thêm vào giỏ
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomerHistoryTab({ orders }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-amber-500">Lịch sử Đặt hàng</h2>
      {orders.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">Bạn chưa đặt đơn hàng nào.</div>
      ) : (
        orders.map((o) => (
          <div key={o.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
            <div className="flex justify-between items-center text-xs border-b border-slate-800 pb-2">
              <span className="text-slate-400">{formatDateTime(o)}</span>
              <span className={`px-2 py-0.5 rounded font-bold ${STATUS_STYLES[o.status] || STATUS_STYLES.pending}`}>
                {STATUS_LABELS[o.status] || o.status}
              </span>
            </div>

            <div className="space-y-1">
              {o.items.map((it, idx) => (
                <div key={idx} className="text-xs flex justify-between text-slate-300">
                  <span>{it.quantity}x {it.name} ({it.sweetness}, {it.ice})</span>
                  <span>{(it.price * it.quantity).toLocaleString()}đ</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                {o.status !== 'cancelled' && (
                  <span className={`font-semibold ${o.paid ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {o.paid ? 'Đã thanh toán' : 'Ghi nợ'}
                  </span>
                )}
                {o.status === 'pending' && (
                  <button
                    onClick={() => window.confirm('Hủy đơn này?') && updateOrder(o.id, { status: 'cancelled' }).catch(showError)}
                    className="text-[11px] text-slate-400 underline hover:text-rose-400"
                  >
                    Hủy đơn
                  </button>
                )}
              </div>
              <span className="font-bold text-amber-500">{o.totalAmount.toLocaleString()}đ</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function CustomerProfileTab({ currentUser }) {
  const [name, setName] = useState(currentUser.name);
  // PIN không đọc được từ máy chủ; để trống nghĩa là giữ PIN cũ
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState(null);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setMsg({ ok: false, text: 'Tên hiển thị không được để trống.' });
    if (pin && !/^\d{4}$/.test(pin)) return setMsg({ ok: false, text: 'Mã PIN phải gồm đúng 4 chữ số.' });
    try {
      if (name.trim() !== currentUser.name) await updateUserName(currentUser.phone, name.trim());
      if (pin) await savePin(currentUser.phone, pin);
      setPin('');
      setMsg({ ok: true, text: 'Đã cập nhật thông tin thành công!' });
    } catch (err) {
      setMsg({ ok: false, text: `Không lưu được: ${err.code || err.message}` });
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-amber-500">Thông tin Cá nhân</h2>
      
      <form onSubmit={handleUpdate} className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Số điện thoại / ID:</label>
          <input type="text" disabled value={currentUser.phone} className="w-full bg-slate-800/50 text-slate-500 p-2 rounded text-sm border border-slate-800" />
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1">Tên hiển thị của bạn:</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-slate-800 text-white p-2 rounded text-sm border border-slate-700 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1">Đổi mã PIN (4 số, để trống nếu giữ nguyên):</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className="w-full bg-slate-800 text-white p-2 rounded text-sm border border-slate-700 focus:outline-none"
          />
        </div>

        {msg && <p className={`text-xs ${msg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{msg.text}</p>}

        <button type="submit" className="w-full bg-amber-500 text-slate-950 font-bold py-2 rounded-lg text-xs">
          Cập nhật Hồ sơ
        </button>
      </form>
    </div>
  );
}
