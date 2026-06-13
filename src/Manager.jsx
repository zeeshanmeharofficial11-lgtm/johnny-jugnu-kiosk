import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://lugtmmcpcgzyytkzqozn.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Z3RtbWNwY2d6eXl0a3pxb3puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzODk0MDQsImV4cCI6MjA3NDk2NTQwNH0.uSEDsRNpH_QGwgGxrrxuYKCkuH3lszd8O9w7GN9INpE';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MANAGER_PASSWORD = 'manager123';

const STATUS_STYLES = {
  Pending:   { badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400' },
  Confirmed: { badge: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-400'   },
  Completed: { badge: 'bg-green-100 text-green-700',  dot: 'bg-green-500'  },
  Cancelled: { badge: 'bg-red-100 text-red-700',      dot: 'bg-red-500'    },
};

function fmt(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-PK', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function Manager() {
  const [loggedIn, setLoggedIn] = useState(() => !!sessionStorage.getItem('mgr'));
  const [password, setPassword]   = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab]   = useState('overview');

  const [orders, setOrders]     = useState([]);
  const [loading, setLoading]   = useState(false);
  const [expanded, setExpanded] = useState(null);

  // Filters
  const [dateFilter,    setDateFilter]    = useState('today');
  const [branchFilter,  setBranchFilter]  = useState('all');
  const [cashierFilter, setCashierFilter] = useState('all');
  const [statusFilter,  setStatusFilter]  = useState('all');
  const [payFilter,     setPayFilter]     = useState('all');
  const [search,        setSearch]        = useState('');

  // ── Auth ──────────────────────────────────────────────
  const login = () => {
    if (password === MANAGER_PASSWORD || password === 'admin123') {
      sessionStorage.setItem('mgr', '1');
      setLoggedIn(true);
      setLoginError('');
    } else {
      setLoginError('Incorrect password');
    }
  };
  const logout = () => { sessionStorage.removeItem('mgr'); setLoggedIn(false); };

  // ── Data ──────────────────────────────────────────────
  const fetchOrders = async () => {
    setLoading(true);
    try {
      let query = supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(1000);

      if (dateFilter !== 'all') {
        const now = new Date();
        let from;
        if (dateFilter === 'today') {
          from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (dateFilter === 'week') {
          from = new Date(now.getTime() - 7  * 86400000);
        } else if (dateFilter === 'month') {
          from = new Date(now.getTime() - 30 * 86400000);
        }
        if (from) query = query.gte('created_at', from.toISOString());
      }

      const { data } = await query;
      if (data) setOrders(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { if (loggedIn) fetchOrders(); }, [loggedIn, dateFilter]);

  // ── Derived ───────────────────────────────────────────
  const branches = useMemo(() =>
    ['all', ...new Set(orders.map(o => o.branch).filter(Boolean))], [orders]);
  const cashiers = useMemo(() =>
    ['all', ...new Set(orders.map(o => o.cashier_name).filter(Boolean))], [orders]);

  const filtered = useMemo(() => {
    let r = orders;
    if (branchFilter  !== 'all') r = r.filter(o => o.branch        === branchFilter);
    if (cashierFilter !== 'all') r = r.filter(o => o.cashier_name  === cashierFilter);
    if (statusFilter  !== 'all') r = r.filter(o => o.status        === statusFilter);
    if (payFilter     !== 'all') r = r.filter(o => o.payment_method === payFilter);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(o =>
        (o.order_number?.toString() || '').includes(q) ||
        (o.customer_name  || '').toLowerCase().includes(q) ||
        (o.customer_phone || '').includes(q) ||
        (o.cashier_name   || '').toLowerCase().includes(q)
      );
    }
    return r;
  }, [orders, branchFilter, cashierFilter, statusFilter, payFilter, search]);

  const stats = useMemo(() => {
    const revenue  = filtered.reduce((s, o) => s + (o.grand_total || 0), 0);
    const byStatus = { Pending: 0, Confirmed: 0, Completed: 0, Cancelled: 0 };
    const byOrderType = { delivery: 0, pickup: 0 };
    const revenueByType = { delivery: 0, pickup: 0 };
    filtered.forEach(o => {
      if (byStatus[o.status] !== undefined) byStatus[o.status]++;
      const t = (o.order_type || '').toLowerCase();
      if (t === 'delivery') { byOrderType.delivery++; revenueByType.delivery += o.grand_total || 0; }
      else                  { byOrderType.pickup++;   revenueByType.pickup   += o.grand_total || 0; }
    });
    return {
      total: filtered.length,
      revenue,
      avg: filtered.length ? Math.round(revenue / filtered.length) : 0,
      byStatus,
      byOrderType,
      revenueByType,
    };
  }, [filtered]);

  const cashierStats = useMemo(() => {
    const map = {};
    filtered.forEach(o => {
      const n = o.cashier_name || 'Unknown';
      if (!map[n]) map[n] = { name: n, id: o.cashier_id, orders: 0, revenue: 0, completed: 0, cancelled: 0, delivery: 0, pickup: 0, deliveryRevenue: 0, pickupRevenue: 0, last: null };
      map[n].orders++;
      map[n].revenue += o.grand_total || 0;
      if (o.status === 'Completed') map[n].completed++;
      const t = (o.order_type || '').toLowerCase();
      if (t === 'delivery') { map[n].delivery++; map[n].deliveryRevenue += o.grand_total || 0; }
      else                  { map[n].pickup++;   map[n].pickupRevenue   += o.grand_total || 0; }
      if (o.status === 'Cancelled') map[n].cancelled++;
      if (!map[n].last || new Date(o.created_at) > new Date(map[n].last)) map[n].last = o.created_at;
    });
    return Object.values(map).sort((a, b) => b.orders - a.orders);
  }, [filtered]);

  // ── Login screen ──────────────────────────────────────
  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-6xl mb-3">📊</div>
            <h1 className="text-3xl font-black text-gray-800">MANAGER PANEL</h1>
            <p className="text-gray-400 text-sm mt-1">Johnny &amp; Jugnu Kiosk</p>
          </div>
          <div className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && login()}
              placeholder="Manager password"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-slate-500 focus:outline-none text-lg"
            />
            {loginError && <p className="text-red-500 text-sm text-center">{loginError}</p>}
            <button onClick={login}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-bold text-lg transition-colors">
              Login
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center mt-4">Default password: manager123</p>
        </div>
      </div>
    );
  }

  // ── Main dashboard ────────────────────────────────────
  const TABS = [
    { id: 'overview', label: '📈 Overview' },
    { id: 'orders',   label: '📋 Order History' },
    { id: 'cashiers', label: '👤 Cashiers' },
  ];

  return (
    <div className="min-h-screen bg-gray-100">

      {/* Top bar */}
      <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black">📊 MANAGER PANEL</h1>
          <p className="text-slate-400 text-xs">Johnny &amp; Jugnu Kiosk</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-300 text-sm hidden sm:block">
            {new Date().toLocaleDateString('en-PK', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
          </span>
          <a href="/" className="text-slate-300 hover:text-white text-sm underline">← Cashier</a>
          <button onClick={logout}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors">
            Logout
          </button>
        </div>
      </div>

      {/* Tab nav */}
      <div className="bg-white border-b px-6 flex gap-1 pt-2">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-5 py-3 font-semibold text-sm border-b-2 transition-colors ${
              activeTab === t.id
                ? 'border-slate-800 text-slate-800'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-4 py-3 flex flex-wrap gap-2 items-center">
        {/* Date */}
        <select value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
          <option value="today">Today</option>
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
          <option value="all">All Time</option>
        </select>
        {/* Branch */}
        <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
          {branches.map(b => <option key={b} value={b}>{b === 'all' ? 'All Branches' : b}</option>)}
        </select>
        {/* Cashier */}
        <select value={cashierFilter} onChange={e => setCashierFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
          {cashiers.map(c => <option key={c} value={c}>{c === 'all' ? 'All Cashiers' : c}</option>)}
        </select>
        {/* Status */}
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
          <option value="all">All Status</option>
          <option value="Pending">Pending</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
        {/* Payment */}
        <select value={payFilter} onChange={e => setPayFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
          <option value="all">All Payments</option>
          <option value="cash">Cash</option>
          <option value="credit">Credit Card</option>
          <option value="online">Online</option>
          <option value="marketing">Marketing PR</option>
        </select>
        {/* Search */}
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Order#, customer, cashier…"
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 flex-1 min-w-40" />
        <button onClick={fetchOrders}
          className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
          🔄
        </button>
        <span className="text-sm text-gray-400 ml-auto font-semibold">{filtered.length} orders</span>
      </div>

      <div className="p-4 sm:p-6">

        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Orders',   value: stats.total,               color: 'text-slate-800' },
                { label: 'Revenue',        value: `PKR ${stats.revenue.toLocaleString()}`, color: 'text-green-700' },
                { label: 'Avg Order',      value: `PKR ${stats.avg}`,         color: 'text-blue-700'  },
                { label: 'Completed',      value: stats.byStatus.Completed,   color: 'text-emerald-700' },
              ].map(k => (
                <div key={k.label} className="bg-white rounded-xl p-5 shadow-sm border">
                  <p className="text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wide">{k.label}</p>
                  <p className={`text-2xl font-black ${k.color}`}>{k.value}</p>
                </div>
              ))}
            </div>

            {/* Status breakdown */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { s: 'Pending',   n: stats.byStatus.Pending,   cls: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
                { s: 'Confirmed', n: stats.byStatus.Confirmed, cls: 'bg-blue-50 border-blue-200 text-blue-700'       },
                { s: 'Completed', n: stats.byStatus.Completed, cls: 'bg-green-50 border-green-200 text-green-700'    },
                { s: 'Cancelled', n: stats.byStatus.Cancelled, cls: 'bg-red-50 border-red-200 text-red-700'          },
              ].map(({ s, n, cls }) => (
                <div key={s} className={`rounded-xl border p-4 text-center ${cls}`}>
                  <p className="text-3xl font-black">{n}</p>
                  <p className="text-sm font-semibold mt-1">{s}</p>
                </div>
              ))}
            </div>

            {/* Order Type breakdown */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">🛵</span>
                  <p className="font-black text-lg text-indigo-800">Delivery</p>
                </div>
                <p className="text-4xl font-black text-indigo-700">{stats.byOrderType.delivery}</p>
                <p className="text-sm text-indigo-500 mt-1 font-semibold">PKR {stats.revenueByType.delivery.toLocaleString()}</p>
              </div>
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">🏃</span>
                  <p className="font-black text-lg text-teal-800">Pickup</p>
                </div>
                <p className="text-4xl font-black text-teal-700">{stats.byOrderType.pickup}</p>
                <p className="text-sm text-teal-500 mt-1 font-semibold">PKR {stats.revenueByType.pickup.toLocaleString()}</p>
              </div>
            </div>

            {/* Recent orders feed */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="px-5 py-3 border-b flex justify-between items-center">
                <h3 className="font-bold text-base">Recent Orders</h3>
                <span className="text-xs text-gray-400">Latest 15</span>
              </div>
              <div className="divide-y">
                {filtered.slice(0, 15).map(o => {
                  const st = STATUS_STYLES[o.status] || { badge: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' };
                  return (
                    <div key={o.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                        <span className="font-mono font-bold text-sm">#JJ{o.order_number}</span>
                        <span className="text-sm text-gray-600 truncate">{o.customer_name || '—'}</span>
                        <span className="text-xs text-gray-400 hidden sm:block">{o.cashier_name} · {o.branch}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${st.badge}`}>{o.status}</span>
                        <span className="font-bold text-sm">PKR {o.grand_total}</span>
                        <span className="text-xs text-gray-400 hidden sm:block">{fmt(o.created_at)}</span>
                      </div>
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <p className="text-center text-gray-400 py-10">No orders for this period</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── ORDER HISTORY ── */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            {loading ? (
              <p className="text-center text-gray-400 py-16">Loading orders…</p>
            ) : filtered.length === 0 ? (
              <p className="text-center text-gray-400 py-16">No orders found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800 text-white text-left">
                    <tr>
                      {['Order #','Time','Customer','Cashier','Branch','Type','Payment','Status','Total',''].map(h => (
                        <th key={h} className="px-3 py-3 font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((o, idx) => {
                      const st = STATUS_STYLES[o.status] || { badge: 'bg-gray-100 text-gray-600' };
                      const isOpen = expanded === o.id;
                      return (
                        <React.Fragment key={o.id}>
                          <tr className={`border-b hover:bg-blue-50 transition-colors ${idx % 2 === 0 ? '' : 'bg-gray-50'}`}>
                            <td className="px-3 py-2 font-mono font-bold">#JJ{o.order_number}</td>
                            <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                              <div>{new Date(o.created_at).toLocaleDateString('en-PK',{month:'short',day:'numeric'})}</div>
                              <div className="text-xs">{new Date(o.created_at).toLocaleTimeString('en-PK',{hour:'2-digit',minute:'2-digit'})}</div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-medium">{o.customer_name || '—'}</div>
                              <div className="text-xs text-gray-400">{o.customer_phone || ''}</div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-medium">{o.cashier_name || '—'}</div>
                              <div className="text-xs text-gray-400">{o.cashier_id || ''}</div>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">{o.branch || '—'}</td>
                            <td className="px-3 py-2 capitalize">{o.order_type || '—'}</td>
                            <td className="px-3 py-2 capitalize">{o.payment_method || '—'}</td>
                            <td className="px-3 py-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${st.badge}`}>{o.status}</span>
                            </td>
                            <td className="px-3 py-2 font-bold text-right whitespace-nowrap">PKR {o.grand_total}</td>
                            <td className="px-3 py-2">
                              <button onClick={() => setExpanded(isOpen ? null : o.id)}
                                className="text-slate-500 hover:text-slate-800 text-xs font-bold whitespace-nowrap">
                                {isOpen ? '▲' : '▼'}
                              </button>
                            </td>
                          </tr>
                          {isOpen && (
                            <tr className="bg-blue-50 border-b">
                              <td colSpan={10} className="px-5 py-4">
                                <div className="grid sm:grid-cols-2 gap-4">
                                  <div>
                                    <p className="font-bold text-slate-700 mb-2">Items</p>
                                    {Array.isArray(o.items) ? (
                                      <div className="space-y-1">
                                        {o.items.map((item, i) => (
                                          <div key={i} className="flex justify-between text-sm bg-white rounded px-3 py-2 border">
                                            <span>
                                              {item.name} × {item.quantity}
                                              {item.withSeasoning && <span className="ml-1 text-xs text-green-600 font-bold">+S</span>}
                                              {item.sauces?.length > 0 && <span className="ml-1 text-xs text-blue-600">({item.sauces.join(', ')})</span>}
                                              {item.remarks && <span className="ml-1 text-xs text-orange-600 italic">— {item.remarks}</span>}
                                            </span>
                                            <span className="font-bold">PKR {item.totalPrice}</span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : <p className="text-gray-400 text-sm">No item data</p>}
                                  </div>
                                  <div className="text-sm space-y-1.5">
                                    {o.customer_address     && <p><strong>Address:</strong> {o.customer_address}</p>}
                                    {o.customer_instructions && <p><strong>Instructions:</strong> {o.customer_instructions}</p>}
                                    <div className="border-t pt-2 mt-2 space-y-1">
                                      <div className="flex justify-between"><span>Items Total</span><span className="font-semibold">PKR {o.items_total}</span></div>
                                      {o.delivery_charge > 0 && <div className="flex justify-between"><span>Delivery</span><span className="font-semibold">PKR {o.delivery_charge}</span></div>}
                                      <div className="flex justify-between font-black text-base border-t pt-1"><span>Grand Total</span><span>PKR {o.grand_total}</span></div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── CASHIERS ── */}
        {activeTab === 'cashiers' && (
          <div>
            {cashierStats.length === 0 ? (
              <p className="text-center text-gray-400 py-16">No cashier data for this period</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cashierStats.map(c => (
                  <div key={c.name} className="bg-white rounded-xl shadow-sm border p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-slate-700 text-white rounded-full flex items-center justify-center font-black text-xl">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-lg leading-tight">{c.name}</p>
                        <p className="text-xs text-gray-400">ID: {c.id || '—'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-slate-50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-black text-slate-800">{c.orders}</p>
                        <p className="text-xs text-gray-500">Total Orders</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3 text-center">
                        <p className="text-lg font-black text-green-700">PKR {c.revenue.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">Revenue</p>
                      </div>
                    </div>
                    <div className="flex gap-2 text-xs flex-wrap">
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded font-bold">✓ {c.completed} done</span>
                      <span className="bg-red-100 text-red-700 px-2 py-1 rounded font-bold">✗ {c.cancelled} cancelled</span>
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded font-bold ml-auto">
                        avg PKR {c.orders ? Math.round(c.revenue / c.orders) : 0}
                      </span>
                    </div>
                    <div className="mt-3 border-t pt-3 space-y-2">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Order Type Breakdown</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2 text-center">
                          <p className="text-base font-black text-indigo-700">🛵 {c.delivery}</p>
                          <p className="text-xs text-indigo-500 font-semibold">Delivery</p>
                          <p className="text-xs text-indigo-400">PKR {c.deliveryRevenue.toLocaleString()}</p>
                        </div>
                        <div className="bg-teal-50 border border-teal-200 rounded-lg p-2 text-center">
                          <p className="text-base font-black text-teal-700">🏃 {c.pickup}</p>
                          <p className="text-xs text-teal-500 font-semibold">Pickup</p>
                          <p className="text-xs text-teal-400">PKR {c.pickupRevenue.toLocaleString()}</p>
                        </div>
                      </div>
                      {c.orders > 0 && (
                        <div className="flex rounded-full overflow-hidden h-2">
                          <div className="bg-indigo-400 transition-all" style={{ width: `${Math.round((c.delivery / c.orders) * 100)}%` }}></div>
                          <div className="bg-teal-400 flex-1"></div>
                        </div>
                      )}
                    </div>
                    {c.last && (
                      <p className="text-xs text-gray-400 mt-3 pt-3 border-t">Last active: {fmt(c.last)}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
