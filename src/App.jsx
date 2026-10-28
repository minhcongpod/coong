import React, { useState, useEffect } from 'react';
import { 
  Coffee, ShoppingBag, History, BarChart3, Wallet, User, 
  Trash2, Plus, Edit, Check, X, ShieldAlert, LogOut, KeyRound, Lock, Search, Filter
} from 'lucide-react';

// --- INITIAL MOCK DATA ---
const INITIAL_MENU = [
  { id: '1', name: 'Cà phê Đen', price: 25000, cost: 8000, active: true, image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=300' },
  { id: '2', name: 'Cà phê Nâu', price: 30000, cost: 10000, active: true, image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=300' },
  { id: '3', name: 'Bạc xỉu', price: 35000, cost: 12000, active: true, image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=300' },
];

const ADMIN_PHONE = '0900000000'; // SĐT Mặc định của Chủ quán

export default function App() {
  // --- STATE SYSTEM ---
  const [menu, setMenu] = useState(() => JSON.parse(localStorage.getItem('coffee_menu')) || INITIAL_MENU);
  const [orders, setOrders] = useState(() => JSON.parse(localStorage.getItem('coffee_orders')) || []);
  const [transactions, setTransactions] = useState(() => JSON.parse(localStorage.getItem('coffee_wallet')) || []);
  const [users, setUsers] = useState(() => JSON.parse(localStorage.getItem('coffee_users')) || {
    [ADMIN_PHONE]: { name: 'Chủ Quán', pin: '0000', role: 'admin' },
    '0912345678': { name: 'Khách A (Đồng nghiệp)', pin: '5678', role: 'customer' }
  });

  // Current Auth State
  const [currentUser, setCurrentUser] = useState(() => JSON.parse(localStorage.getItem('coffee_current_user')) || null);
  const [isPinVerified, setIsPinVerified] = useState(() => JSON.parse(localStorage.getItem('coffee_pin_verified')) || false);
  
  // Auth Form State
  const [inputPin, setInputPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Local URL Auto Detect Customer Link (eg: ?user=khacha or ?user=0912345678)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userParam = params.get('user') || params.get('c');

    if (userParam) {
      const cleanPhone = userParam.toLowerCase() === 'admin' ? ADMIN_PHONE : userParam;
      
      let targetUser = users[cleanPhone];
      if (!targetUser) {
        targetUser = { 
          name: cleanPhone.length === 10 ? `Khách (${cleanPhone.slice(-4)})` : userParam, 
          pin: cleanPhone.length >= 4 ? cleanPhone.slice(-4) : '1234',
          role: cleanPhone === ADMIN_PHONE ? 'admin' : 'customer' 
        };
        const updatedUsers = { ...users, [cleanPhone]: targetUser };
        setUsers(updatedUsers);
        localStorage.setItem('coffee_users', JSON.stringify(updatedUsers));
      }

      if (!currentUser || currentUser.phone !== cleanPhone) {
        const userObj = { phone: cleanPhone, ...targetUser };
        setCurrentUser(userObj);
        setIsPinVerified(false);
        localStorage.setItem('coffee_current_user', JSON.stringify(userObj));
        localStorage.setItem('coffee_pin_verified', 'false');
      }
    }
  }, []);

  // Sync LocalStorage
  useEffect(() => { localStorage.setItem('coffee_menu', JSON.stringify(menu)); }, [menu]);
  useEffect(() => { localStorage.setItem('coffee_orders', JSON.stringify(orders)); }, [orders]);
  useEffect(() => { localStorage.setItem('coffee_wallet', JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { localStorage.setItem('coffee_users', JSON.stringify(users)); }, [users]);

  // PIN Verification
  const handleVerifyPin = (e) => {
    e.preventDefault();
    if (!currentUser) return;
    
    if (inputPin === currentUser.pin) {
      setIsPinVerified(true);
      localStorage.setItem('coffee_pin_verified', 'true');
      setPinError('');
    } else {
      setPinError('Mã PIN không đúng! Vui lòng thử 4 số cuối SĐT.');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsPinVerified(false);
    localStorage.removeItem('coffee_current_user');
    localStorage.removeItem('coffee_pin_verified');
  };

  // --- UNVERIFIED PIN SCREEN ---
  if (!currentUser || !isPinVerified) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-700 text-white rounded-2xl p-6 w-full max-w-md shadow-xl text-center">
          <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold mb-1">Xác thực Quyền truy cập</h1>
          <p className="text-slate-400 text-sm mb-6">
            {currentUser ? `Xin chào ${currentUser.name}! Vui lòng nhập 4 số cuối SĐT để tiếp tục.` : 'Nhập mã PIN để mở khóa đường link cá nhân.'}
          </p>

          <form onSubmit={handleVerifyPin} className="space-y-4">
            <input
              type="password"
              maxLength={4}
              placeholder="Nhập mã PIN (4 số)"
              value={inputPin}
              onChange={(e) => setInputPin(e.target.value)}
              className="w-full text-center text-2xl tracking-widest bg-slate-900 border border-slate-700 rounded-xl py-3 text-white focus:outline-none focus:border-amber-500"
            />
            {pinError && <p className="text-rose-400 text-xs">{pinError}</p>}
            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold py-3 rounded-xl transition-all"
            >
              Mở khóa
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-700/50 text-xs text-slate-500">
            Mã PIN mặc định là 4 số cuối SĐT cá nhân của bạn.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="bg-slate-900/80 border-b border-slate-800 px-4 py-3 sticky top-0 z-50 backdrop-blur-md flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="bg-amber-500/20 p-2 rounded-lg border border-amber-500/30">
            <Coffee className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <span className="font-bold text-base text-slate-100 block leading-tight">CongCa Coffee</span>
            <span className="text-[10px] text-amber-400 font-medium uppercase tracking-wider">
              {currentUser.role === 'admin' ? 'Quyền Chủ Quán' : `Khách: ${currentUser.name}`}
            </span>
          </div>
        </div>

        <button 
          onClick={handleLogout}
          className="text-slate-400 hover:text-rose-400 p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-xs flex items-center gap-1 border border-slate-700/50"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Thoát</span>
        </button>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto p-4 pb-24">
        {currentUser.role === 'admin' ? (
          <AdminDashboard 
            menu={menu} setMenu={setMenu} 
            orders={orders} setOrders={setOrders} 
            transactions={transactions} setTransactions={setTransactions} 
          />
        ) : (
          <CustomerDashboard 
            currentUser={currentUser} setCurrentUser={setCurrentUser}
            menu={menu} orders={orders} setOrders={setOrders} 
            users={users} setUsers={setUsers}
          />
        )}
      </main>
    </div>
  );
}

// ADMIN DASHBOARD
function AdminDashboard({ menu, setMenu, orders, setOrders, transactions, setTransactions }) {
  const [activeTab, setActiveTab] = useState('orders');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
        {[
          { id: 'menu', label: '1. Menu', icon: Coffee },
          { id: 'orders', label: '2. Đơn hàng', icon: History },
          { id: 'reports', label: '3. Báo cáo', icon: BarChart3 },
          { id: 'wallet', label: '4. Sổ Thu Chi', icon: Wallet },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center py-2 rounded-lg text-xs font-medium transition-all ${
                isActive ? 'bg-amber-500 text-slate-950 font-bold shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4 mb-1" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'menu' && <AdminMenuTab menu={menu} setMenu={setMenu} />}
      {activeTab === 'orders' && <AdminOrdersTab orders={orders} setOrders={setOrders} />}
      {activeTab === 'reports' && <AdminReportsTab orders={orders} transactions={transactions} />}
      {activeTab === 'wallet' && <AdminWalletTab transactions={transactions} setTransactions={setTransactions} />}
    </div>
  );
}

function AdminMenuTab({ menu, setMenu }) {
  const toggleActive = (id) => {
    setMenu(menu.map(item => item.id === id ? { ...item, active: !item.active } : item));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-amber-500">Quản lý Menu món</h2>
        <button className="bg-amber-500 text-slate-950 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1">
          <Plus className="w-4 h-4" /> Thêm món mới
        </button>
      </div>

      <div className="space-y-3">
        {menu.map((item) => (
          <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex gap-3 items-center">
            <img src={item.image} alt={item.name} className="w-16 h-16 rounded-lg object-cover" />
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-slate-100">{item.name}</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${item.active ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500'}`}>
                  {item.active ? 'Đang bán' : 'Hết hàng'}
                </span>
              </div>
              <p className="text-xs text-amber-400 font-semibold mt-1">{item.price.toLocaleString()}đ <span className="text-slate-500 font-normal">(Vốn: {item.cost.toLocaleString()}đ)</span></p>
            </div>
            <button onClick={() => toggleActive(item.id)} className="p-1.5 rounded bg-slate-800 text-slate-300 hover:text-white text-xs">
              {item.active ? 'Ẩn' : 'Hiện'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminOrdersTab({ orders, setOrders }) {
  const updateOrderStatus = (orderId, newStatus) => {
    setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
  };

  const togglePayment = (orderId) => {
    setOrders(orders.map(o => o.id === orderId ? { ...o, paid: !o.paid } : o));
  };

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-amber-500">Quản lý Đơn hàng</h2>
      {orders.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">Chưa có đơn hàng nào.</div>
      ) : (
        orders.map((order) => (
          <div key={order.id} className={`bg-slate-900 border rounded-xl p-4 space-y-3 ${order.status === 'cancelled' ? 'border-rose-900/50 opacity-60' : 'border-slate-800'}`}>
            <div className="flex justify-between items-start border-b border-slate-800 pb-2">
              <div>
                <span className="font-bold text-slate-100">{order.customerName}</span>
                <span className="text-xs text-slate-500 block">{order.time}</span>
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
                    onClick={() => togglePayment(order.id)}
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

function AdminReportsTab({ orders, transactions }) {
  const [filter, setFilter] = useState('day');
  const validOrders = orders.filter(o => o.status !== 'cancelled');
  
  const totalOrders = validOrders.length;
  const totalRevenue = validOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalDebt = validOrders.filter(o => !o.paid).reduce((sum, o) => sum + o.totalAmount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const netProfit = totalRevenue - totalExpense;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-amber-500">Báo cáo Doanh thu</h2>
        <div className="flex gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
          {['day', 'week', 'month'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 text-xs rounded ${filter === f ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'}`}
            >
              {f === 'day' ? 'Ngày' : f === 'week' ? 'Tuần' : 'Tháng'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
          <span className="text-xs text-slate-400 block">Số đơn hoàn thành</span>
          <span className="text-xl font-bold text-white mt-1 block">{totalOrders}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
          <span className="text-xs text-slate-400 block">Công nợ (Chưa thu)</span>
          <span className="text-xl font-bold text-rose-400 mt-1 block">{totalDebt.toLocaleString()}đ</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
          <span className="text-xs text-slate-400 block">Tổng Chi tiêu</span>
          <span className="text-xl font-bold text-amber-400 mt-1 block">{totalExpense.toLocaleString()}đ</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
          <span className="text-xs text-slate-400 block">Lợi nhuận Ròng</span>
          <span className="text-xl font-bold text-emerald-400 mt-1 block">{netProfit.toLocaleString()}đ</span>
        </div>
      </div>
    </div>
  );
}

function AdminWalletTab({ transactions, setTransactions }) {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [quickCategory, setQuickCategory] = useState('');

  const QUICK_EXPENSES = ['Cà phê', 'Sữa tươi', 'Sữa đặc', 'Cốc & Nắp', 'Ống hút', 'Khác'];

  const handleAdd = (e) => {
    e.preventDefault();
    if (!amount) return;

    const newTx = {
      id: Date.now().toString(),
      type,
      amount: Number(amount),
      description: quickCategory ? `[${quickCategory}] ${description}` : description,
      date: new Date().toLocaleDateString('vi-VN'),
    };

    setTransactions([newTx, ...transactions]);
    setAmount('');
    setDescription('');
    setQuickCategory('');
  };

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
                onClick={() => setQuickCategory(cat)}
                className={`text-[10px] px-2 py-1 rounded border ${quickCategory === cat ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        <input
          type="number"
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
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lịch sử Giao dịch</h3>
        {transactions.map((tx) => (
          <div key={tx.id} className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex justify-between items-center text-xs">
            <div>
              <span className="font-semibold block text-slate-200">{tx.description || 'Giao dịch'}</span>
              <span className="text-[10px] text-slate-500">{tx.date}</span>
            </div>
            <span className={`font-bold ${tx.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {tx.type === 'income' ? '+' : '-'}{tx.amount.toLocaleString()}đ
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// CUSTOMER DASHBOARD
function CustomerDashboard({ currentUser, setCurrentUser, menu, orders, setOrders, users, setUsers }) {
  const [activeTab, setActiveTab] = useState('menu');
  const [cart, setCart] = useState([]);
  const [note, setNote] = useState('');

  const myOrders = orders.filter(o => o.customerPhone === currentUser.phone);
  const unpaidOrders = myOrders.filter(o => !o.paid && o.status !== 'cancelled');
  const debtTotal = unpaidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  const addToCart = (item, options) => {
    setCart([...cart, { ...item, ...options, cartId: Date.now().toString() }]);
  };

  const handlePlaceOrder = () => {
    if (cart.length === 0) return;

    const newOrder = {
      id: 'ORD-' + Date.now().toString().slice(-4),
      customerPhone: currentUser.phone,
      customerName: currentUser.name,
      items: cart,
      note,
      totalAmount: cart.reduce((sum, i) => sum + (i.price * (i.quantity || 1)), 0),
      status: 'pending',
      paid: false,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };

    setOrders([newOrder, ...orders]);
    setCart([]);
    setNote('');
    setActiveTab('history');
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
          addToCart={addToCart} onPlaceOrder={handlePlaceOrder}
          note={note} setNote={setNote}
        />
      )}
      {activeTab === 'history' && <CustomerHistoryTab orders={myOrders} />}
      {activeTab === 'profile' && (
        <CustomerProfileTab 
          currentUser={currentUser} setCurrentUser={setCurrentUser}
          users={users} setUsers={setUsers}
        />
      )}
    </div>
  );
}

function CustomerMenuTab({ menu, cart, setCart, addToCart, onPlaceOrder, note, setNote }) {
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
            className="w-full bg-amber-500 text-slate-950 font-bold py-2.5 rounded-lg text-sm shadow-lg"
          >
            Gửi Đặt Hàng ({cart.reduce((s, i) => s + (i.price * i.quantity), 0).toLocaleString()}đ)
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
              <span className="text-slate-400">{o.time}</span>
              <span className={`px-2 py-0.5 rounded font-bold ${
                o.status === 'cancelled' ? 'bg-rose-900/40 text-rose-400' :
                o.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {o.status === 'cancelled' ? 'Đã hủy ❌' : o.status === 'completed' ? 'Hoàn thành' : 'Đang pha...'}
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
              <span className={`font-semibold ${o.paid ? 'text-emerald-400' : 'text-rose-400'}`}>
                {o.paid ? 'Đã thanh toán' : 'Ghi nợ'}
              </span>
              <span className="font-bold text-amber-500">{o.totalAmount.toLocaleString()}đ</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function CustomerProfileTab({ currentUser, setCurrentUser, users, setUsers }) {
  const [name, setName] = useState(currentUser.name);
  const [pin, setPin] = useState(currentUser.pin);
  const [msg, setMsg] = useState('');

  const handleUpdate = (e) => {
    e.preventDefault();
    const updatedUser = { ...currentUser, name, pin };
    const updatedUsers = { ...users, [currentUser.phone]: updatedUser };

    setCurrentUser(updatedUser);
    setUsers(updatedUsers);
    localStorage.setItem('coffee_current_user', JSON.stringify(updatedUser));
    localStorage.setItem('coffee_users', JSON.stringify(updatedUsers));
    setMsg('Đã cập nhật thông tin thành công!');
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
          <label className="text-xs text-slate-400 block mb-1">Mã PIN bảo mật (4 số):</label>
          <input
            type="password"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full bg-slate-800 text-white p-2 rounded text-sm border border-slate-700 focus:outline-none"
          />
        </div>

        {msg && <p className="text-emerald-400 text-xs">{msg}</p>}

        <button type="submit" className="w-full bg-amber-500 text-slate-950 font-bold py-2 rounded-lg text-xs">
          Cập nhật Hồ sơ
        </button>
      </form>
    </div>
  );
}
