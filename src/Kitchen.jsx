import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// ✅ Supabase connection
const SUPABASE_URL =
  process.env.REACT_APP_SUPABASE_URL ||
  "https://lugtmmcpcgzyytkzqozn.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Z3RtbWNwY2d6eXl0a3pxb3puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzODk0MDQsImV4cCI6MjA3NDk2NTQwNH0.uSEDsRNpH_QGwgGxrrxuYKCkuH3lszd8O9w7GN9INpE";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 🔖 Branch tabs
const BRANCHES = ["Phase 6", "Phase 4", "Johar Town", "Bahria Town", "Cloud Kitchen", "Emporium"];

// 🔤 Payment label formatter
function formatPayment(pm?: string | null) {
  const val = String(pm || "").toLowerCase();
  if (val === "marketing" || val === "marketing pr tab" || val === "marketing_pr") return "Marketing PR Tab";
  if (val === "credit") return "Credit Card";
  if (val === "online") return "Online";
  if (val === "cash") return "Cash";
  return pm || "—";
}

// 🧹 Items may arrive as JSON string or already-parsed array
function normalizeItems(items: any): Array<any> {
  if (!items) return [];
  if (Array.isArray(items)) return items;
  try {
    const parsed = JSON.parse(items);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// 💵 Currency helper
function formatPKR(v: any) {
  const num = typeof v === "number" ? v : Number(v ?? 0);
  return `PKR ${num.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;
}

// 📋 Small copy button
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };
  return (
    <button
      onClick={doCopy}
      className="ml-2 text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 font-semibold"
      title="Copy to clipboard"
      type="button"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Kitchen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // 🔐 Simple login
  const [loggedIn, setLoggedIn] = useState(localStorage.getItem("kitchenLoggedIn") === "true");
  const [loginInfo, setLoginInfo] = useState({ id: "", password: "" });
  const [loginError, setLoginError] = useState("");

  // 🏷 Branch tab (persisted)
  const [selectedBranch, setSelectedBranch] = useState(
    localStorage.getItem("kitchenBranch") || BRANCHES[0]
  );

  const HARD_CODED_USER = { id: "kitchen", password: "6767" };

  const handleLogin = () => {
    if (
      loginInfo.id.trim().toLowerCase() === HARD_CODED_USER.id &&
      loginInfo.password === HARD_CODED_USER.password
    ) {
      localStorage.setItem("kitchenLoggedIn", "true");
      setLoggedIn(true);
      setLoginError("");
    } else {
      setLoginError("Invalid credentials. Try again.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("kitchenLoggedIn");
    setLoggedIn(false);
    setOrders([]);
  };

  // ✅ Fetch active orders (filtered by branch)
  async function fetchOrders(branch = selectedBranch) {
    if (!branch) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("branch", branch)
      .not("status", "in", '("Completed","Cancelled")')
      .order("created_at", { ascending: true });

    if (error) {
      console.error("❌ Error fetching orders:", error);
    } else {
      setOrders(data || []);
      setLastUpdate(new Date());
    }
    setLoading(false);
  }

  // ✅ Update order status
  async function updateOrderStatus(orderId: number | string, status: string) {
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (error) {
      console.error("Error updating order:", error);
      alert("Failed to update order status");
    } else {
      fetchOrders();
    }
  }

  // ✅ Realtime subscription
  useEffect(() => {
    if (!loggedIn || !selectedBranch) return;
    fetchOrders(selectedBranch);

    const channel = supabase
      .channel(`orders-realtime-${selectedBranch}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `branch=eq.${selectedBranch}` },
        (payload) => {
          setOrders((prev) => {
            if (["Completed", "Cancelled"].includes(payload.new?.status ?? "")) return prev;
            return [...prev, payload.new].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `branch=eq.${selectedBranch}` },
        (payload) => {
          setOrders((prev) => {
            if (["Completed", "Cancelled"].includes(payload.new?.status ?? "")) {
              return prev.filter((o) => o.id !== payload.new.id);
            }
            return prev.map((o) => (o.id === payload.new.id ? payload.new : o));
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "orders", filter: `branch=eq.${selectedBranch}` },
        (payload) => setOrders((prev) => prev.filter((o) => o.id !== payload.old.id))
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loggedIn, selectedBranch]);

  // ✅ Auto-refresh every 30s
  useEffect(() => {
    if (!loggedIn || !selectedBranch) return;
    const interval = setInterval(() => fetchOrders(selectedBranch), 30000);
    return () => clearInterval(interval);
  }, [loggedIn, selectedBranch]);

  const handleBranchChange = (branch: string) => {
    setSelectedBranch(branch);
    localStorage.setItem("kitchenBranch", branch);
    fetchOrders(branch);
  };

  // ==============================
  // 🔒 LOGIN SCREEN
  // ==============================
  if (!loggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-6">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
          <h1 className="text-3xl font-black text-center text-orange-600 mb-6">KITCHEN PANEL LOGIN</h1>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">User ID</label>
              <input
                type="text"
                value={loginInfo.id}
                onChange={(e) => setLoginInfo({ ...loginInfo, id: e.target.value })}
                className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-orange-500"
                placeholder="Enter ID (e.g. kitchen)"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Password</label>
              <input
                type="password"
                value={loginInfo.password}
                onChange={(e) => setLoginInfo({ ...loginInfo, password: e.target.value })}
                className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-orange-500"
                placeholder="Enter password"
              />
            </div>
            {loginError && <p className="text-sm text-red-600 font-semibold">{loginError}</p>}
            <button
              onClick={handleLogin}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-bold mt-4 transition-colors"
            >
              Log In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==============================
  // 🍔 KITCHEN DASHBOARD
  // ==============================
  return (
    <div className="min-h-screen bg-gray-900 p-4 sm:p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-lg shadow-xl p-4 sm:p-6 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-white text-center sm:text-left">
          <h1 className="text-2xl sm:text-4xl font-black mb-1">🍔 KITCHEN DISPLAY</h1>
          <p className="text-xs sm:text-sm opacity-80">Last updated: {lastUpdate.toLocaleTimeString()}</p>
        </div>
        <div className="flex items-center gap-2 justify-center sm:justify-end">
          <button
            onClick={() => fetchOrders()}
            disabled={loading}
            className="bg-white/90 hover:bg-white text-orange-600 px-4 py-2 rounded-lg font-bold transition-colors"
          >
            {loading ? "🔄 Refreshing..." : "🔄 Refresh"}
          </button>
          <button
            onClick={handleLogout}
            className="bg-white text-red-600 font-bold px-4 py-2 rounded-lg shadow-md hover:bg-gray-100 transition"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Branch Tabs */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {BRANCHES.map((b) => {
            const isActive = b === selectedBranch;
            return (
              <button
                key={b}
                onClick={() => handleBranchChange(b)}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${
                  isActive ? "bg-orange-500 text-white shadow" : "bg-white text-gray-800 hover:bg-gray-100"
                }`}
              >
                {b}
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders Grid */}
      {loading && orders.length === 0 ? (
        <div className="text-center text-white text-lg py-20">
          <div className="animate-spin text-6xl mb-4">⏳</div>
          <p>Loading orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center text-white text-lg py-20">
          <div className="text-6xl mb-4">✅</div>
          <p className="text-2xl font-bold">No Active Orders</p>
          <p className="text-sm opacity-70 mt-2">
            Branch: <span className="font-semibold">{selectedBranch}</span>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {orders.map((order) => {
            const items = normalizeItems(order.items);
            const address = order.customer_address?.trim() || "";
            const mapsUrl = address
              ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
              : "";

            return (
              <div
                key={order.id}
                className="bg-white shadow-2xl rounded-lg p-4 border-4 border-orange-400 transform hover:scale-105 transition-transform"
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg p-3 mb-3">
                  <h2 className="text-2xl font-black text-center">#{order.order_number}</h2>
                  <p className="text-center text-sm font-semibold opacity-90">
                    {new Date(order.created_at).toLocaleTimeString()}
                  </p>
                  <p className="text-center text-xs opacity-90 mt-1">
                    🏷 Branch: <span className="font-bold">{order.branch}</span>
                  </p>
                </div>

                {/* Customer Info */}
                <div className="bg-blue-50 rounded-lg p-3 mb-3">
                  <p className="text-gray-800 text-sm font-bold mb-1">👤 {order.customer_name}</p>
                  <p className="text-gray-700 text-xs">📱 {order.customer_phone}</p>
                  <div className="flex gap-2 mt-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold ${
                        order.order_type === "delivery" ? "bg-purple-500 text-white" : "bg-green-500 text-white"
                      }`}
                    >
                      {order.order_type === "delivery" ? "🚗 DELIVERY" : "🏃 PICKUP"}
                    </span>
                    <span className="px-2 py-1 rounded text-xs font-bold bg-gray-200 text-gray-800">
                      💳 {formatPayment(order.payment_method)}
                    </span>
                  </div>
                </div>

                {/* 🧾 ORDER DETAILS — includes Address */}
                <div className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-200">
                  <h3 className="font-black text-sm mb-2 text-gray-800">🧾 ORDER DETAILS</h3>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-700">
                    <div><span className="font-semibold">Order #:</span> {order.order_number}</div>
                    <div><span className="font-semibold">Created:</span> {new Date(order.created_at).toLocaleString()}</div>
                    <div><span className="font-semibold">Branch:</span> {order.branch || "—"}</div>
                    <div><span className="font-semibold">Type:</span> {order.order_type}</div>
                    <div><span className="font-semibold">Payment:</span> {formatPayment(order.payment_method)}</div>
                    <div><span className="font-semibold">Cashier:</span> {order.cashier_name || "—"}</div>

                    {/* Address row spans both columns for readability */}
                    <div className="col-span-2 mt-2">
                      <span className="font-semibold">Address:</span>{" "}
                      {address ? (
                        <>
                          <span className="break-words">{address}</span>
                          <CopyButton text={address} />
                          {mapsUrl && (
                            <a
                              className="ml-2 text-xs px-2 py-1 rounded bg-orange-100 hover:bg-orange-200 text-orange-700 font-semibold"
                              href={mapsUrl}
                              target="_blank"
                              rel="noreferrer"
                              title="Open in Google Maps"
                            >
                              Directions
                            </a>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div className="bg-yellow-50 rounded-lg p-3 mb-3 border-2 border-yellow-200">
                  <h3 className="font-black text-sm mb-2 text-gray-800">📋 ORDER ITEMS:</h3>
                  <ul className="space-y-2">
                    {items.map((item: any, i: number) => {
                      const addons = item.addons || item.add_ons || [];
                      return (
                        <li key={i} className="border-b border-yellow-200 pb-2 last:border-b-0">
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-sm text-gray-800">{item.name}</span>
                            <span className="bg-orange-500 text-white px-2 py-1 rounded-full text-xs font-black">
                              x{item.quantity}
                            </span>
                          </div>

                          {Array.isArray(item.sauces) && item.sauces.length > 0 && (
                            <div className="mt-1">
                              <p className="text-xs font-bold text-gray-600">🥫 Sauces:</p>
                              <ul className="ml-4 list-disc text-xs text-gray-700">
                                {item.sauces.map((s: string, idx: number) => (
                                  <li key={idx}>{s}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {Array.isArray(addons) && addons.length > 0 && (
                            <div className="mt-1">
                              <p className="text-xs font-bold text-gray-600">➕ Add-ons:</p>
                              <ul className="ml-4 list-disc text-xs text-gray-700">
                                {addons.map((a: string, idx: number) => (
                                  <li key={idx}>{a}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {item.withSeasoning && (
                            <div className="mt-1 bg-green-500 text-white text-xs px-2 py-1 rounded inline-block">
                              ✨ WITH SEASONING
                            </div>
                          )}

                          {item.remarks?.trim() && (
                            <div className="mt-2 bg-red-100 border-2 border-red-400 text-red-900 text-xs rounded px-2 py-2 font-bold">
                              ⚠️ SPECIAL REQUEST: {item.remarks}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Total */}
                <div className="bg-gray-800 text-white rounded-lg p-3 mb-3 text-center">
                  <p className="text-xs font-semibold opacity-80">TOTAL</p>
                  <p className="text-2xl font-black">{formatPKR(order.grand_total)}</p>
                </div>

                {/* Status */}
                <div className="mb-3 text-center">
                  <span
                    className={`px-4 py-2 rounded-lg text-white text-sm font-black inline-block ${
                      order.status === "Pending"
                        ? "bg-yellow-500 animate-pulse"
                        : order.status === "Confirmed"
                        ? "bg-green-500"
                        : order.status === "Cancelled"
                        ? "bg-red-500"
                        : "bg-gray-500"
                    }`}
                  >
                    {order.status === "Pending" && "⏳ NEW ORDER"}
                    {order.status === "Confirmed" && "👨‍🍳 PUNCHING"}
                    {order.status === "Cancelled" && "❌ CANCELLED"}
                    {!["Pending", "Confirmed", "Cancelled"].includes(order.status) && order.status}
                  </span>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => updateOrderStatus(order.id, "Confirmed")}
                    disabled={order.status === "Confirmed"}
                    className="bg-green-500 hover:bg-green-600 text-white px-2 py-3 rounded-lg font-bold text-xs disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    ✅ CONFIRM
                  </button>
                  <button
                    onClick={() => updateOrderStatus(order.id, "Completed")}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-3 rounded-lg font-bold text-xs transition-colors"
                  >
                    🏁 COMPLETED
                  </button>
                  <button
                    onClick={() => updateOrderStatus(order.id, "Cancelled")}
                    className="bg-red-500 hover:bg-red-600 text-white px-2 py-3 rounded-lg font-bold text-xs transition-colors"
                  >
                    ❌ CANCEL
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Kitchen;
