import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const HARD_CODED_USER = {
  id: import.meta.env.VITE_CALLCENTER_USER,
  password: import.meta.env.VITE_CALLCENTER_PASSWORD,
};

const DEFAULT_BRANCHES = [
  "Phase 6",
  "Phase 4",
  "Johar Town",
  "Bahria Town",
  "Cloud Kitchen",
  "Emporium",
];

const STATUS_STYLES = {
  Pending: "bg-yellow-100 text-yellow-700",
  Confirmed: "bg-blue-100 text-blue-700",
  Completed: "bg-green-100 text-green-700",
  Cancelled: "bg-red-100 text-red-700",
};

function formatPayment(pm) {
  const val = String(pm || "").toLowerCase();
  if (val === "marketing" || val === "marketing pr tab" || val === "marketing_pr")
    return "Marketing PR Tab";
  if (val === "credit") return "Credit Card";
  if (val === "online") return "Online";
  if (val === "cash") return "Cash";
  return pm || "—";
}

// created_at is stored as PKT but tagged as UTC, so subtract 5h to correct it
// (same quirk handled in Kitchen.jsx — keep both in sync if this ever changes)
function shiftMinus5Hours(d) {
  if (!d) return null;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(date.getHours() - 5);
  return date;
}

function formatDateTime(d) {
  const shifted = shiftMinus5Hours(d);
  if (!shifted) return "—";
  return shifted.toLocaleString("en-PK", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function safeParseJSON(maybeJSON) {
  if (Array.isArray(maybeJSON)) return maybeJSON;
  if (maybeJSON == null) return [];
  try {
    const parsed = JSON.parse(maybeJSON);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function downloadOrderTicket(order) {
  const items = safeParseJSON(order.items);
  const address = order.customer_address || "—";
  const instructions = (order.customer_instructions || "").trim();
  const createdStr = formatDateTime(order.created_at);

  const esc = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const addonLabel = (a) =>
    typeof a === "string" ? a : a.price ? `${a.name} (+PKR ${a.price})` : a.name;

  const itemLinesHtml = items
    .map((it, idx) => {
      const qty = it.quantity ?? 1;
      const name = esc(it.name ?? "Item");
      const unitPrice = it.unitPrice ?? it.finalPrice ?? 0;
      const lineTotal = it.totalPrice ?? unitPrice * qty;
      const sauces = Array.isArray(it.sauces) ? it.sauces : [];
      const addons = Array.isArray(it.addons) ? it.addons : [];
      const seasoning = it.withSeasoning ? `<div class="subline">✨ WITH SEASONING</div>` : "";
      const remarks = it.remarks?.trim()
        ? `<div class="warn">⚠️ ${esc(it.remarks)}</div>`
        : "";
      const saucesHtml = sauces.length
        ? `<div class="subline"><b>🥫 Sauces:</b> ${esc(sauces.join(", "))}</div>`
        : "";
      const addonsHtml = addons.length
        ? `<div class="subline"><b>➕ Add-ons:</b> ${esc(addons.map(addonLabel).join(", "))}</div>`
        : "";
      return `
        <div class="item">
          <div class="row"><div class="left"><span class="itemNum">${idx + 1}.</span><b>${name}</b></div><div class="right">PKR ${esc(lineTotal)}</div></div>
          <div class="subline">Qty ${esc(qty)} × PKR ${esc(unitPrice)}</div>
          ${saucesHtml}${addonsHtml}${seasoning}${remarks}
        </div>`;
    })
    .join("");

  const html = `
<!doctype html>
<html><head><meta charset="utf-8" />
<title>Call Center Copy #${esc(order.order_number)}</title>
<style>
  body { margin: 0; font-family: Arial, sans-serif; color: #111; }
  .wrap { width: 320px; padding: 14px; }
  .center { text-align: center; }
  .h1 { font-size: 18px; font-weight: 800; margin: 0; }
  .muted { opacity: .75; font-size: 12px; margin-top: 4px; }
  .divider { border-top: 1px dashed #333; margin: 10px 0; }
  .row { display: flex; justify-content: space-between; gap: 10px; }
  .left { flex: 1; word-break: break-word; overflow-wrap: break-word; } .right { white-space: nowrap; font-weight: 700; }
  .label { font-size: 12px; font-weight: 700; }
  .value { font-size: 12px; margin-top: 2px; word-break: break-word; overflow-wrap: break-word; }
  .item { padding: 10px 0; border-bottom: 1px dashed #bbb; }
  .item:last-child { border-bottom: 0; }
  .itemNum { color: #999; font-weight: 700; margin-right: 4px; }
  .subline { font-size: 11px; margin-top: 4px; opacity: .9; word-break: break-word; overflow-wrap: break-word; }
  .totalsBox { background: #f7f7f7; border: 1px solid #e6e6e6; border-radius: 6px; padding: 8px 10px; margin-top: 4px; }
  .totalsRow { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; margin-top: 4px; }
  .totalsRow:first-child { margin-top: 0; }
  .grandRow { border-top: 2px solid #111; margin-top: 8px; padding-top: 8px; }
  .total { font-size: 16px; font-weight: 900; }
  .warn { margin-top: 6px; padding: 6px; border: 1px solid #b91c1c; background: #fee2e2; font-size: 11px; font-weight: 800; word-break: break-word; overflow-wrap: break-word; }
  @media print { @page { margin: 8mm; } }
</style></head>
<body><div class="wrap">
  <div class="center">
    <p class="h1">JOHNNY &amp; JUGNU — CALL CENTER COPY</p>
    <div style="margin-top:8px; font-size:20px; font-weight:900;">#${esc(order.order_number)}</div>
    <div class="muted">${esc(createdStr)}</div>
    <div class="muted">Branch: <b>${esc(order.branch)}</b> · Cashier: <b>${esc(order.cashier_name)}</b></div>
  </div>
  <div class="divider"></div>
  <div>
    <div class="label">Customer</div><div class="value">👤 ${esc(order.customer_name || "—")}</div>
    <div class="label" style="margin-top:8px;">Phone</div><div class="value">📱 ${esc(order.customer_phone || "—")}</div>
    <div class="label" style="margin-top:8px;">Address</div><div class="value">📍 ${esc(address)}</div>
    ${instructions ? `<div class="label" style="margin-top:8px;">Instructions</div><div class="value">📝 ${esc(instructions)}</div>` : ""}
  </div>
  <div class="divider"></div>
  <div class="label">Items</div>
  <div style="margin-top:6px;">${itemLinesHtml || `<div class="muted">No items</div>`}</div>
  <div class="divider"></div>
  <div class="totalsBox">
    <div class="totalsRow"><div class="left">Items Subtotal</div><div class="right">PKR ${esc(order.items_total ?? order.grand_total)}</div></div>
    ${
      order.delivery_charge > 0
        ? `<div class="totalsRow"><div class="left">Delivery Charge</div><div class="right">PKR ${esc(order.delivery_charge)}</div></div>`
        : ""
    }
    <div class="row grandRow"><div class="left"><b>GRAND TOTAL</b></div><div class="right total">PKR ${esc(order.grand_total)}</div></div>
  </div>
</div>
<script>window.onload = () => { setTimeout(() => window.print(), 150); };</script>
</body></html>`;

  const w = window.open("", "_blank", "width=420,height=700");
  if (!w) {
    alert("Popup blocked. Please allow popups to download/print ticket.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function playNewOrderSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[660, 0], [880, 0.15]].forEach(([freq, when]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.35, ctx.currentTime + when);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + 0.3);
      osc.start(ctx.currentTime + when);
      osc.stop(ctx.currentTime + when + 0.3);
    });
  } catch (e) {
    console.warn("Audio error:", e);
  }
}

export default function CallCenter() {
  const [loggedIn, setLoggedIn] = useState(
    localStorage.getItem("callCenterLoggedIn") === "true"
  );
  const [loginInfo, setLoginInfo] = useState({ id: "", password: "" });
  const [loginError, setLoginError] = useState("");

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState(DEFAULT_BRANCHES);

  const [dateFilter, setDateFilter] = useState("today");
  const [branchFilter, setBranchFilter] = useState("all");
  const [syncFilter, setSyncFilter] = useState("unsent");
  const [search, setSearch] = useState("");

  const handleLogin = () => {
    if (
      loginInfo.id.trim().toLowerCase() === (HARD_CODED_USER.id || "").toLowerCase() &&
      loginInfo.password === HARD_CODED_USER.password
    ) {
      localStorage.setItem("callCenterLoggedIn", "true");
      setLoggedIn(true);
      setLoginError("");
    } else {
      setLoginError("Invalid credentials. Try again.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("callCenterLoggedIn");
    setLoggedIn(false);
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1000);

      if (dateFilter !== "all") {
        const now = new Date();
        let from;
        if (dateFilter === "today") from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        else if (dateFilter === "week") from = new Date(now.getTime() - 7 * 86400000);
        else if (dateFilter === "month") from = new Date(now.getTime() - 30 * 86400000);
        if (from) query = query.gte("created_at", from.toISOString());
      }

      const { data, error } = await query;
      if (error) console.error("Error fetching orders:", error);
      else setOrders(data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (loggedIn) fetchOrders();
  }, [loggedIn, dateFilter]);

  // Load branch list from kiosk_config
  useEffect(() => {
    if (!loggedIn) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("kiosk_config")
          .select("config_data")
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();
        if (!error && data?.config_data?.branches?.length > 0) {
          setBranches(data.config_data.branches);
        }
      } catch (e) {
        console.warn("Could not load branches:", e);
      }
    })();
  }, [loggedIn]);

  // Realtime: any new order (any branch) gets appended + a sound alert
  useEffect(() => {
    if (!loggedIn) return;
    const channel = supabase
      .channel("callcenter-orders-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          setOrders((prev) => [...prev, payload.new]);
          playNewOrderSound();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          setOrders((prev) => prev.map((o) => (o.id === payload.new.id ? payload.new : o)));
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [loggedIn]);

  const markSentToExe = async (order, sent) => {
    const { error } = await supabase
      .from("orders")
      .update({ sent_to_exe: sent, sent_to_exe_at: sent ? new Date().toISOString() : null })
      .eq("id", order.id);
    if (error) {
      console.error("Error updating sent_to_exe:", error);
      alert("Failed to update. Check your connection and try again.");
      return;
    }
    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id
          ? { ...o, sent_to_exe: sent, sent_to_exe_at: sent ? new Date().toISOString() : null }
          : o
      )
    );
  };

  const filtered = useMemo(() => {
    let r = orders;
    if (branchFilter !== "all") r = r.filter((o) => o.branch === branchFilter);
    if (syncFilter === "unsent") r = r.filter((o) => !o.sent_to_exe);
    else if (syncFilter === "sent") r = r.filter((o) => !!o.sent_to_exe);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(
        (o) =>
          (o.order_number?.toString() || "").includes(q) ||
          (o.customer_name || "").toLowerCase().includes(q) ||
          (o.customer_phone || "").includes(q) ||
          (o.cashier_name || "").toLowerCase().includes(q) ||
          (o.branch || "").toLowerCase().includes(q)
      );
    }
    return r;
  }, [orders, branchFilter, syncFilter, search]);

  const unsentCount = useMemo(() => orders.filter((o) => !o.sent_to_exe).length, [orders]);
  const sentCount = useMemo(() => orders.filter((o) => !!o.sent_to_exe).length, [orders]);

  if (!loggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-indigo-950 p-6">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
          <div className="text-center mb-6">
            <div className="text-5xl mb-2">📞</div>
            <h1 className="text-2xl font-black text-indigo-700">CALL CENTER LOGIN</h1>
            <p className="text-gray-400 text-sm mt-1">Johnny &amp; Jugnu Kiosk</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">User ID</label>
              <input
                type="text"
                value={loginInfo.id}
                onChange={(e) => setLoginInfo({ ...loginInfo, id: e.target.value })}
                className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter ID"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Password</label>
              <input
                type="password"
                value={loginInfo.password}
                onChange={(e) => setLoginInfo({ ...loginInfo, password: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter password"
              />
            </div>
            {loginError && <p className="text-sm text-red-600 font-semibold">{loginError}</p>}
            <button
              onClick={handleLogin}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-bold mt-2 transition-colors"
            >
              Log In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top bar */}
      <div className="bg-indigo-950 text-white px-6 py-4 flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-black">📞 CALL CENTER</h1>
          <p className="text-indigo-300 text-xs">Johnny &amp; Jugnu Kiosk — cross-branch order relay to EXE</p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/" className="text-indigo-300 hover:text-white text-sm underline">← Cashier</a>
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="bg-indigo-700 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
          >
            {loading ? "🔄 Loading…" : "🔄 Refresh"}
          </button>
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 sm:p-6 pb-0">
        <div className="bg-white rounded-xl p-4 shadow-sm border text-center">
          <p className="text-2xl font-black text-gray-800">{filtered.length}</p>
          <p className="text-xs text-gray-400 font-semibold uppercase">Showing</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-orange-700">{unsentCount}</p>
          <p className="text-xs text-orange-500 font-semibold uppercase">Not Sent to EXE</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-green-700">{sentCount}</p>
          <p className="text-xs text-green-500 font-semibold uppercase">Sent to EXE</p>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 sm:p-6 pb-2 flex flex-wrap gap-2 items-center">
        <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
          <option value="today">Today</option>
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
          <option value="all">All Time</option>
        </select>
        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
          <option value="all">All Branches</option>
          {branches.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={syncFilter} onChange={(e) => setSyncFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
          <option value="unsent">Not Sent to EXE</option>
          <option value="sent">Sent to EXE</option>
          <option value="all">All</option>
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Order#, customer, cashier, branch…"
          className="flex-1 min-w-48 border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      {/* Orders */}
      <div className="p-4 sm:p-6 pt-2">
        {loading && orders.length === 0 ? (
          <div className="text-center text-gray-400 py-20">Loading orders…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-400 py-20">
            <div className="text-5xl mb-3">✅</div>
            <p className="text-xl font-bold">Nothing here</p>
            <p className="text-sm mt-1">Try a different filter, or you're all caught up.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((order) => {
              const items = safeParseJSON(order.items);
              const sent = !!order.sent_to_exe;
              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-xl shadow-sm border-2 p-4 ${
                    sent ? "border-green-200" : "border-orange-200"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-mono font-black text-lg">#JJ{order.order_number}</span>
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-bold ${STATUS_STYLES[order.status] || "bg-gray-100 text-gray-600"}`}>
                        {order.status}
                      </span>
                    </div>
                    <button
                      onClick={() => downloadOrderTicket(order)}
                      className="text-xs bg-gray-900 text-white px-2 py-1 rounded-lg hover:bg-black"
                      title="Print / download ticket"
                    >
                      ⬇️ Ticket
                    </button>
                  </div>

                  <p className="text-xs text-gray-400 mb-2">
                    🏷 <b>{order.branch}</b> · 👨‍💼 {order.cashier_name || "—"} · {formatDateTime(order.created_at)}
                  </p>

                  <div className="bg-blue-50 rounded-lg p-3 mb-2 text-sm">
                    <p className="font-bold text-gray-800">👤 {order.customer_name || "—"}</p>
                    <p className="text-gray-700 text-xs mt-0.5">📱 {order.customer_phone || "—"}</p>
                    <p className="text-gray-700 text-xs mt-0.5 break-words">📍 {order.customer_address || "—"}</p>
                    {order.customer_instructions && (
                      <p className="text-red-700 text-xs mt-1 font-semibold break-words">⚠️ {order.customer_instructions}</p>
                    )}
                    <div className="flex gap-2 mt-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                        {order.order_type === "delivery" ? "🚗 Delivery" : "🏃 Pickup"}
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-gray-200 text-gray-700">
                        💳 {formatPayment(order.payment_method)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3 text-sm">
                    <ul className="space-y-1">
                      {items.map((item, i) => (
                        <li key={i} className="flex justify-between gap-2">
                          <span>
                            {item.name} × {item.quantity}
                            {item.sauces?.length > 0 && (
                              <span className="text-xs text-blue-600"> ({item.sauces.join(", ")})</span>
                            )}
                            {item.remarks && <span className="text-xs text-orange-600 italic"> — {item.remarks}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs text-gray-400 font-semibold">TOTAL</span>
                    <span className="font-black text-lg">PKR {order.grand_total}</span>
                  </div>

                  {sent ? (
                    <div className="flex items-center justify-between bg-green-50 border border-green-300 rounded-lg px-3 py-2">
                      <span className="text-green-700 text-sm font-bold">
                        ✅ Sent to EXE{order.sent_to_exe_at ? ` · ${formatDateTime(order.sent_to_exe_at)}` : ""}
                      </span>
                      <button
                        onClick={() => markSentToExe(order, false)}
                        className="text-xs text-gray-500 underline hover:text-gray-700"
                      >
                        Undo
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => markSentToExe(order, true)}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-bold text-sm transition-colors"
                    >
                      📞 Mark Sent to EXE
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
