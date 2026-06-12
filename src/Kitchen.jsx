import React, { useEffect, useState, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ✅ Supabase connection
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://lugtmmcpcgzyytkzqozn.supabase.co";
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Z3RtbWNwY2d6eXl0a3pxb3puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzODk0MDQsImV4cCI6MjA3NDk2NTQwNH0.uSEDsRNpH_QGwgGxrrxuYKCkuH3lszd8O9w7GN9INpE";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 🔖 Fallback branch list (used until Supabase config loads)
const DEFAULT_BRANCHES = [
  "Phase 6",
  "Phase 4",
  "Johar Town",
  "Bahria Town",
  "Cloud Kitchen",
  "Emporium",
];

// 🔤 Payment label formatter
function formatPayment(pm) {
  const val = String(pm || "").toLowerCase();
  if (val === "marketing" || val === "marketing pr tab" || val === "marketing_pr")
    return "Marketing PR Tab";
  if (val === "credit") return "Credit Card";
  if (val === "online") return "Online";
  if (val === "cash") return "Cash";
  return pm || "—";
}

// 🕒 Time helpers – just subtract 5 hours from the stored time
function shiftMinus5Hours(d) {
  if (!d) return null;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(date.getHours() - 5);
  return date;
}

function formatOrderTime(d) {
  const shifted = shiftMinus5Hours(d);
  if (!shifted) return "";
  return shifted.toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatOrderDateTime(d) {
  const shifted = shiftMinus5Hours(d);
  if (!shifted) return "";
  return shifted.toLocaleString("en-PK", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

// 🧰 Safe JSON for items
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

// 🧾 Build a printable ticket + trigger Print (user can "Save as PDF")
function downloadOrderTicket(order) {
  const items = safeParseJSON(order.items);
  const address = order.address || order.customer_address || "—";
  const instructions = (order.customer_instructions || "").trim();
  const createdStr = formatOrderDateTime(order.created_at);

  const esc = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const itemLinesHtml = items
    .map((it) => {
      const qty = it.quantity ?? 1;
      const name = esc(it.name ?? "Item");

      const sauces =
        Array.isArray(it.sauces) && it.sauces.length ? it.sauces : [];

      const addons =
        Array.isArray(it.addons) && it.addons.length
          ? it.addons
          : Array.isArray(it.add_ons) && it.add_ons.length
          ? it.add_ons
          : [];

      const seasoning = it.withSeasoning
        ? `<div class="subline">✨ WITH SEASONING</div>`
        : "";

      const remarks = it.remarks?.trim()
        ? `<div class="warn">⚠️ SPECIAL REQUEST: ${esc(it.remarks)}</div>`
        : "";

      const saucesHtml = sauces.length
        ? `<div class="subline"><b>🥫 Sauces:</b> ${esc(
            sauces.join(", ")
          )}</div>`
        : "";

      const addonsHtml = addons.length
        ? `<div class="subline"><b>➕ Add-ons:</b> ${esc(
            addons.join(", ")
          )}</div>`
        : "";

      return `
        <div class="item">
          <div class="row">
            <div class="left"><b>${name}</b></div>
            <div class="right">x${esc(qty)}</div>
          </div>
          ${saucesHtml}
          ${addonsHtml}
          ${seasoning}
          ${remarks}
        </div>
      `;
    })
    .join("");

  const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Ticket #${esc(order.order_number)}</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; color: #111; }
    .wrap { width: 320px; padding: 14px; }
    .center { text-align: center; }
    .h1 { font-size: 20px; font-weight: 800; margin: 0; }
    .muted { opacity: .75; font-size: 12px; margin-top: 4px; }
    .divider { border-top: 1px dashed #333; margin: 10px 0; }
    .row { display: flex; justify-content: space-between; gap: 10px; }
    .left { flex: 1; }
    .right { white-space: nowrap; font-weight: 700; }
    .label { font-size: 12px; font-weight: 700; }
    .value { font-size: 12px; margin-top: 2px; word-break: break-word; }
    .item { padding: 8px 0; border-bottom: 1px dashed #ddd; }
    .item:last-child { border-bottom: 0; }
    .subline { font-size: 11px; margin-top: 4px; opacity: .9; }
    .pill { display: inline-block; padding: 4px 8px; border: 1px solid #111; border-radius: 999px; font-size: 11px; font-weight: 700; margin: 6px 4px 0 0; }
    .total { font-size: 16px; font-weight: 900; }
    .warn { margin-top: 6px; padding: 6px; border: 1px solid #b91c1c; background: #fee2e2; font-size: 11px; font-weight: 800; }
    @media print { @page { margin: 8mm; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="center">
      <p class="h1">JOHNNY & JUGNU</p>
      <div class="muted">KITCHEN TICKET</div>
      <div style="margin-top:8px; font-size:22px; font-weight:900;">#${esc(
        order.order_number
      )}</div>
      <div class="muted">${esc(createdStr)}</div>
      <div class="muted">Branch: <b>${esc(order.branch)}</b></div>
    </div>

    <div class="divider"></div>

    <div>
      <div class="label">Customer</div>
      <div class="value">👤 ${esc(order.customer_name || "—")}</div>

      <div class="label" style="margin-top:8px;">Phone</div>
      <div class="value">📱 ${esc(order.customer_phone || "—")}</div>

      <div class="label" style="margin-top:8px;">Address</div>
      <div class="value">📍 ${esc(address)}</div>

      ${
        instructions
          ? `<div class="label" style="margin-top:8px;">Instructions</div>
             <div class="value">📝 ${esc(instructions)}</div>`
          : ""
      }

      <div style="margin-top:8px;">
        <span class="pill">${
          order.order_type === "delivery" ? "🚗 DELIVERY" : "🏃 PICKUP"
        }</span>
        <span class="pill">💳 ${esc(formatPayment(order.payment_method))}</span>
      </div>
    </div>

    <div class="divider"></div>

    <div class="label">Items</div>
    <div style="margin-top:6px;">
      ${itemLinesHtml || `<div class="muted">No items</div>`}
    </div>

    <div class="divider"></div>

    <div class="row">
      <div class="left"><b>TOTAL</b></div>
      <div class="right total">PKR ${esc(order.grand_total)}</div>
    </div>

    <div class="divider"></div>

    <div class="center muted">
      Printed from Kitchen Panel
    </div>
  </div>

  <script>
    window.onload = () => { setTimeout(() => window.print(), 150); };
  </script>
</body>
</html>
  `;

  const w = window.open("", "_blank", "width=420,height=700");
  if (!w) {
    alert("Popup blocked. Please allow popups to download/print ticket.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function Kitchen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // 🔐 Simple login
  const [loggedIn, setLoggedIn] = useState(
    localStorage.getItem("kitchenLoggedIn") === "true"
  );
  const [loginInfo, setLoginInfo] = useState({ id: "", password: "" });
  const [loginError, setLoginError] = useState("");

  // 🏷 Current branch tab (persisted)
  const [selectedBranch, setSelectedBranch] = useState(
    localStorage.getItem("kitchenBranch") || DEFAULT_BRANCHES[0]
  );

  // 🎯 NEW: Enhanced features
  const [fullscreenMode, setFullscreenMode] = useState(
    localStorage.getItem("kitchenFullscreen") === "true"
  );
  const [groupByCategory, setGroupByCategory] = useState(
    localStorage.getItem("kitchenGroupByCategory") === "true"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [enableSound, setEnableSound] = useState(
    localStorage.getItem("kitchenSound") !== "false"
  );
  const [clockTime, setClockTime] = useState(new Date());
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  const [branches, setBranches] = useState(DEFAULT_BRANCHES);
  const [branchNewOrderCounts, setBranchNewOrderCounts] = useState({});

  // Refs to avoid stale closures in Realtime callbacks
  const enableSoundRef = useRef(enableSound);
  useEffect(() => { enableSoundRef.current = enableSound; }, [enableSound]);

  const selectedBranchRef = useRef(selectedBranch);
  useEffect(() => { selectedBranchRef.current = selectedBranch; }, [selectedBranch]);

  const HARD_CODED_USER = { id: "kitchen", password: "9696" };

  const playNewOrderSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [[880, 0], [1100, 0.15], [880, 0.3]].forEach(([freq, when]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.4, ctx.currentTime + when);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + 0.3);
        osc.start(ctx.currentTime + when);
        osc.stop(ctx.currentTime + when + 0.3);
      });
    } catch (e) {
      console.warn("Audio error:", e);
    }
  };

  // ✅ Handle login
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

  // ✅ Handle logout
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
  async function updateOrderStatus(orderId, status) {
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", orderId);
    if (error) {
      console.error("Error updating order:", error);
      alert("Failed to update order status");
    } else {
      console.log(`✅ Order ${orderId} status updated to ${status}`);
      fetchOrders();
    }
  }

  // ✅ Realtime subscription (rebind when branch or login changes)
  useEffect(() => {
    if (!loggedIn || !selectedBranch) return;

    console.log("🔌 Setting up Supabase Realtime for branch:", selectedBranch);
    // Initial load
    fetchOrders(selectedBranch);

    const channel = supabase
      .channel(`orders-realtime-${selectedBranch}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `branch=eq.${selectedBranch}`,
        },
        (payload) => {
          console.log("🆕 New order received:", payload.new);
          setOrders((prev) => {
            if (["Completed", "Cancelled"].includes(payload.new?.status ?? ""))
              return prev;
            return [...prev, payload.new].sort(
              (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime()
            );
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `branch=eq.${selectedBranch}`,
        },
        (payload) => {
          console.log("♻️ Order updated:", payload.new);
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
        {
          event: "DELETE",
          schema: "public",
          table: "orders",
          filter: `branch=eq.${selectedBranch}`,
        },
        (payload) => {
          console.log("🗑 Order deleted:", payload.old);
          setOrders((prev) => prev.filter((o) => o.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      console.log("🧹 Cleaning up Realtime for branch:", selectedBranch);
      supabase.removeChannel(channel);
    };
  }, [loggedIn, selectedBranch]);

  // ✅ Auto-refresh every 30 s (per branch)
  useEffect(() => {
    if (!loggedIn || !selectedBranch) return;
    const interval = setInterval(() => {
      console.log("🔄 Backup refresh triggered for:", selectedBranch);
      fetchOrders(selectedBranch);
    }, 30000);
    return () => clearInterval(interval);
  }, [loggedIn, selectedBranch]);

  // Load branches from Supabase kiosk_config
  useEffect(() => {
    if (!loggedIn) return;
    async function loadBranches() {
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
        console.warn("Could not load branches from config:", e);
      }
    }
    loadBranches();
  }, [loggedIn]);

  // 🎯 NEW: Clock ticker
  useEffect(() => {
    const interval = setInterval(() => setClockTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Per-branch notification subscriptions: badge counts + sound for every branch
  // Uses filtered subscriptions (RLS-safe) instead of a single unfiltered global channel
  useEffect(() => {
    if (!loggedIn || branches.length === 0) return;

    const channels = branches.map((b) =>
      supabase
        .channel(`notif-${b}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "orders", filter: `branch=eq.${b}` },
          (payload) => {
            const orderBranch = payload.new?.branch || b;

            // Only badge non-selected branches; the active tab is already visible
            if (orderBranch !== selectedBranchRef.current) {
              setBranchNewOrderCounts((prev) => ({
                ...prev,
                [orderBranch]: (prev[orderBranch] || 0) + 1,
              }));
            }

            // Sound for ALL branches (use ref to avoid stale closure)
            if (enableSoundRef.current) playNewOrderSound();
          }
        )
        .subscribe()
    );

    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [loggedIn, branches]);

  // 🎯 NEW: Keyboard shortcuts (1-3 for quick status updates)
  useEffect(() => {
    if (!loggedIn || !selectedOrderId) return;

    const handleKeyPress = (e) => {
      const selectedOrder = orders.find(o => o.id === selectedOrderId);
      if (!selectedOrder) return;

      if (e.key === "1" || e.key === "!") {
        e.preventDefault();
        updateOrderStatus(selectedOrder.id, "Confirmed");
      } else if (e.key === "2" || e.key === "@") {
        e.preventDefault();
        updateOrderStatus(selectedOrder.id, "Completed");
      } else if (e.key === "3" || e.key === "#") {
        e.preventDefault();
        updateOrderStatus(selectedOrder.id, "Cancelled");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const currentIdx = orders.findIndex(o => o.id === selectedOrderId);
        if (currentIdx < orders.length - 1) {
          setSelectedOrderId(orders[currentIdx + 1].id);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const currentIdx = orders.findIndex(o => o.id === selectedOrderId);
        if (currentIdx > 0) {
          setSelectedOrderId(orders[currentIdx - 1].id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [loggedIn, selectedOrderId, orders]);

  // ✅ Change branch tab
  const handleBranchChange = (branch) => {
    setSelectedBranch(branch);
    localStorage.setItem("kitchenBranch", branch);
    fetchOrders(branch);
    // Clear the notification badge for this branch
    setBranchNewOrderCounts((prev) => ({ ...prev, [branch]: 0 }));
  };

  // 🎯 NEW: Helper functions
  
  // Calculate elapsed time in minutes and urgency level
  const getOrderMetrics = (order) => {
    const createdTime = new Date(order.created_at).getTime();
    const now = Date.now();
    const elapsedMs = now - createdTime;
    const elapsedMins = Math.floor(elapsedMs / 60000);
    
    let urgency = "normal";
    let urgencyColor = "bg-gray-100";
    
    if (order.status === "Pending") {
      if (elapsedMins > 15) {
        urgency = "critical";
        urgencyColor = "border-red-500 bg-red-50";
      } else if (elapsedMins > 8) {
        urgency = "high";
        urgencyColor = "border-orange-500 bg-orange-50";
      } else if (elapsedMins > 3) {
        urgency = "medium";
        urgencyColor = "border-yellow-500 bg-yellow-50";
      }
    }
    
    return { elapsedMins, urgency, urgencyColor };
  };

  // Format elapsed time display
  const formatElapsedTime = (mins) => {
    if (mins < 1) return "Now";
    if (mins === 1) return "1 min";
    return `${mins} mins`;
  };

  // Calculate queue statistics
  const queueStats = {
    total: orders.length,
    pending: orders.filter(o => o.status === "Pending").length,
    confirmed: orders.filter(o => o.status === "Confirmed").length,
    avgWaitMins: orders.length > 0 
      ? Math.round(orders.reduce((sum, o) => sum + getOrderMetrics(o).elapsedMins, 0) / orders.length)
      : 0,
    oldestMins: orders.length > 0
      ? Math.max(...orders.map(o => getOrderMetrics(o).elapsedMins))
      : 0
  };

  // Group orders by prep category
  const groupOrdersByCategory = (ordersList) => {
    const grouped = {};
    ordersList.forEach(order => {
      const items = safeParseJSON(order.items);
      const mainCategory = items.length > 0 ? items[0].category || "other" : "other";
      if (!grouped[mainCategory]) grouped[mainCategory] = [];
      grouped[mainCategory].push(order);
    });
    return grouped;
  };

  // Filter orders by search query
  const getFilteredOrders = () => {
    if (!searchQuery) return orders;
    const q = searchQuery.toLowerCase();
    return orders.filter(o =>
      (o.order_number?.toString() ?? '').includes(searchQuery) ||
      (o.customer_name ?? '').toLowerCase().includes(q) ||
      (o.customer_phone ?? '').toString().includes(searchQuery)
    );
  };

  // ==============================
  // 🔒 LOGIN SCREEN
  // ==============================
  if (!loggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-6">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
          <h1 className="text-3xl font-black text-center text-orange-600 mb-6">
            KITCHEN PANEL LOGIN
          </h1>
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
                onChange={(e) =>
                  setLoginInfo({ ...loginInfo, password: e.target.value })
                }
                className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-orange-500"
                placeholder="Enter password"
              />
            </div>
            {loginError && (
              <p className="text-sm text-red-600 font-semibold">{loginError}</p>
            )}
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
  const filteredOrders = getFilteredOrders();
  const displayOrders = groupByCategory 
    ? Object.entries(groupOrdersByCategory(filteredOrders)).flatMap(([_, items]) => items)
    : filteredOrders;

  return (
    <div className={`min-h-screen bg-gray-900 transition-all ${fullscreenMode ? "p-2" : "p-4 sm:p-6"}`} style={{ fontSize: fullscreenMode ? "1.1rem" : "1rem" }}>
      {/* 🎯 NEW: Queue Dashboard Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-3 text-white text-center shadow-lg">
          <p className={`${fullscreenMode ? "text-2xl" : "text-lg"} font-black`}>{queueStats.total}</p>
          <p className={`${fullscreenMode ? "text-sm" : "text-xs"} opacity-90`}>TOTAL</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg p-3 text-white text-center shadow-lg animate-pulse">
          <p className={`${fullscreenMode ? "text-2xl" : "text-lg"} font-black`}>{queueStats.pending}</p>
          <p className={`${fullscreenMode ? "text-sm" : "text-xs"} opacity-90`}>PENDING</p>
        </div>
        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-lg p-3 text-white text-center shadow-lg">
          <p className={`${fullscreenMode ? "text-2xl" : "text-lg"} font-black`}>{queueStats.confirmed}</p>
          <p className={`${fullscreenMode ? "text-sm" : "text-xs"} opacity-90`}>PUNCHING</p>
        </div>
        <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg p-3 text-white text-center shadow-lg">
          <p className={`${fullscreenMode ? "text-2xl" : "text-lg"} font-black`}>{queueStats.avgWaitMins}m</p>
          <p className={`${fullscreenMode ? "text-sm" : "text-xs"} opacity-90`}>AVG WAIT</p>
        </div>
        <div className={`bg-gradient-to-br rounded-lg p-3 text-white text-center shadow-lg ${queueStats.oldestMins > 15 ? "from-red-600 to-red-700 animate-pulse" : "from-orange-600 to-orange-700"}`}>
          <p className={`${fullscreenMode ? "text-2xl" : "text-lg"} font-black`}>{queueStats.oldestMins}m</p>
          <p className={`${fullscreenMode ? "text-sm" : "text-xs"} opacity-90`}>OLDEST</p>
        </div>
      </div>

      {/* Header */}
      <div className={`bg-gradient-to-r from-orange-500 to-red-500 rounded-lg shadow-xl p-4 mb-4 flex flex-col gap-3`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-white">
            <h1 className={`${fullscreenMode ? "text-5xl" : "text-2xl sm:text-4xl"} font-black mb-1`}>
              🍔 KITCHEN DISPLAY
            </h1>
            <p className={`${fullscreenMode ? "text-base" : "text-xs"} opacity-90 mt-1`}>
              🕐 {clockTime.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })} • 
              Branch: <span className="font-bold">{selectedBranch}</span>
            </p>
          </div>
          <div className={`flex items-center gap-2 ${fullscreenMode ? "flex-wrap" : ""}`}>
            <button
              onClick={() => {
                setFullscreenMode(!fullscreenMode);
                localStorage.setItem("kitchenFullscreen", !fullscreenMode);
              }}
              className={`${fullscreenMode ? "bg-blue-500" : "bg-white/90"} hover:bg-white text-orange-600 px-3 py-2 rounded-lg font-bold transition-colors text-sm`}
              title="Toggle Fullscreen Mode"
            >
              {fullscreenMode ? "🔲 Exit" : "🖥️ Full"}
            </button>
            <button
              onClick={() => {
                setEnableSound(!enableSound);
                localStorage.setItem("kitchenSound", enableSound);
              }}
              className={`${enableSound ? "bg-green-500" : "bg-gray-400"} text-white px-3 py-2 rounded-lg font-bold transition-colors text-sm`}
              title="Toggle Sound Alerts"
            >
              {enableSound ? "🔊" : "🔇"}
            </button>
            <button
              onClick={() => fetchOrders()}
              disabled={loading}
              className="bg-white/90 hover:bg-white text-orange-600 px-3 py-2 rounded-lg font-bold transition-colors text-sm"
            >
              {loading ? "🔄" : "🔄"}
            </button>
            <button
              onClick={handleLogout}
              className="bg-white text-red-600 font-bold px-3 py-2 rounded-lg shadow-md hover:bg-gray-100 transition text-sm"
            >
              Logout
            </button>
          </div>
        </div>

        {/* 🎯 NEW: Search Bar & Filters */}
        <div className="flex flex-col sm:flex-row gap-2 items-stretch">
          <input
            type="text"
            placeholder="🔍 Search by order#, name, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`flex-1 px-4 py-2 rounded-lg text-gray-800 font-semibold ${fullscreenMode ? "text-lg" : ""}`}
          />
          <button
            onClick={() => setGroupByCategory(!groupByCategory)}
            className={`px-4 py-2 rounded-lg font-bold transition-colors whitespace-nowrap ${
              groupByCategory
                ? "bg-blue-400 text-white"
                : "bg-white/80 text-gray-800 hover:bg-white"
            }`}
            title="Group by prep category"
          >
            {groupByCategory ? "📦 Grouped" : "📋 List"}
          </button>
        </div>
      </div>

      {/* Branch Tabs */}
      <div className="mb-6 overflow-x-auto pt-3 pb-1">
        <div className="flex gap-2 min-w-max">
          {branches.map((b) => {
            const isActive = b === selectedBranch;
            const notifCount = branchNewOrderCounts[b] || 0;
            return (
              <button
                key={b}
                onClick={() => handleBranchChange(b)}
                className={`relative px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-orange-500 text-white shadow"
                    : notifCount > 0
                    ? "bg-white text-gray-800 ring-2 ring-red-500"
                    : "bg-white text-gray-800 hover:bg-gray-100"
                }`}
              >
                {b}
                {notifCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-black rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 animate-pulse">
                    {notifCount > 9 ? "9+" : notifCount}
                  </span>
                )}
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
      ) : filteredOrders.length === 0 && searchQuery ? (
        <div className="text-center text-white text-lg py-20">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-2xl font-bold">No orders found</p>
          <p className="text-sm opacity-70 mt-2">Search: <span className="font-semibold">{searchQuery}</span></p>
        </div>
      ) : displayOrders.length === 0 ? (
        <div className="text-center text-white text-lg py-20">
          <div className="text-6xl mb-4">✅</div>
          <p className={`${fullscreenMode ? "text-4xl" : "text-2xl"} font-bold`}>No Active Orders</p>
          <p className="text-sm opacity-70 mt-2">
            Branch: <span className="font-semibold">{selectedBranch}</span>
          </p>
        </div>
      ) : (
        <div className={`grid ${fullscreenMode ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"} gap-4 sm:gap-6`}>
          {displayOrders.map((order) => {
            const items = safeParseJSON(order.items);
            const address = order.address || order.customer_address || "—";
            const instructions = (order.customer_instructions || "").trim();
            const { elapsedMins, urgency, urgencyColor } = getOrderMetrics(order);
            const isSelected = order.id === selectedOrderId;

            return (
              <div
                key={order.id}
                onClick={() => setSelectedOrderId(order.id)}
                className={`relative bg-white shadow-2xl rounded-lg p-4 border-4 transform transition-all cursor-pointer ${
                  isSelected 
                    ? "border-green-500 scale-105 ring-4 ring-green-400" 
                    : urgencyColor
                } ${fullscreenMode ? "text-lg" : ""}`}
              >
                {/* 🎯 NEW: Urgency indicator & elapsed time */}
                {order.status === "Pending" && (
                  <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                    <span className={`px-2 py-1 rounded text-white font-black text-xs ${
                      urgency === "critical" ? "bg-red-600 animate-pulse" :
                      urgency === "high" ? "bg-orange-600 animate-bounce" :
                      urgency === "medium" ? "bg-yellow-600" :
                      "bg-gray-500"
                    }`}>
                      {formatElapsedTime(elapsedMins)}
                    </span>
                    {urgency !== "normal" && (
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        urgency === "critical" ? "bg-red-100 text-red-700" :
                        urgency === "high" ? "bg-orange-100 text-orange-700" :
                        "bg-yellow-100 text-yellow-700"
                      }`}>
                        {urgency.toUpperCase()}
                      </span>
                    )}
                  </div>
                )}

                {/* ⬇️ Download ticket */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadOrderTicket(order);
                  }}
                  className="absolute top-2 left-2 bg-gray-900 text-white text-xs font-bold px-3 py-2 rounded-lg shadow hover:bg-black transition"
                  title="Download / Print Ticket"
                >
                  ⬇️ Ticket
                </button>

                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg p-3 mb-3">
                  <h2 className={`${fullscreenMode ? "text-4xl" : "text-2xl"} font-black text-center`}>
                    #{order.order_number}
                  </h2>
                  <p className={`text-center ${fullscreenMode ? "text-base" : "text-sm"} font-semibold opacity-90`}>
                    {formatOrderTime(order.created_at)}
                  </p>
                  <p className={`text-center ${fullscreenMode ? "text-sm" : "text-xs"} opacity-90 mt-1`}>
                    🏷 {order.branch}
                  </p>
                </div>

                {/* 🎯 NEW: Visual timeline progress */}
                <div className="mb-3 flex gap-1">
                  <div className={`flex-1 h-2 rounded ${order.status === "Pending" ? "bg-gray-200" : "bg-yellow-500"}`} title="Pending"></div>
                  <div className={`flex-1 h-2 rounded ${order.status === "Confirmed" ? "bg-green-500" : "bg-gray-200"}`} title="Confirmed"></div>
                  <div className={`flex-1 h-2 rounded ${order.status === "Completed" ? "bg-blue-500" : "bg-gray-200"}`} title="Completed"></div>
                </div>

                {/* Customer Info */}
                <div className="bg-blue-50 rounded-lg p-3 mb-3">
                  <p className={`text-gray-800 ${fullscreenMode ? "text-lg" : "text-sm"} font-bold mb-1`}>
                    👤 {order.customer_name}
                  </p>
                  <p className={`text-gray-700 ${fullscreenMode ? "text-base" : "text-xs"}`}>📱 {order.customer_phone}</p>
                  <p className={`text-gray-700 ${fullscreenMode ? "text-base" : "text-xs"} mt-1 break-words`}>
                    📍 {address}
                  </p>

                  {/* 🎯 NEW: Special requests highlight */}
                  {instructions && (
                    <div className="mt-2 bg-red-100 border-2 border-red-400 rounded p-2">
                      <p className={`font-black text-red-700 ${fullscreenMode ? "text-base" : "text-xs"}`}>
                        ⚠️ SPECIAL INSTRUCTIONS
                      </p>
                      <p className={`text-red-800 ${fullscreenMode ? "text-base" : "text-xs"} whitespace-pre-line break-words mt-1 font-semibold`}>
                        {instructions}
                      </p>
                    </div>
                  )}

                  <div className={`flex gap-2 mt-2 ${fullscreenMode ? "flex-col" : ""}`}>
                    <span
                      className={`px-2 py-1 rounded ${fullscreenMode ? "text-base" : "text-xs"} font-bold text-white ${
                        order.order_type === "delivery"
                          ? "bg-purple-500"
                          : "bg-green-500"
                      }`}
                    >
                      {order.order_type === "delivery" ? "🚗 DELIVERY" : "🏃 PICKUP"}
                    </span>
                    <span className={`px-2 py-1 rounded ${fullscreenMode ? "text-base" : "text-xs"} font-bold bg-gray-200 text-gray-800`}>
                      💳 {formatPayment(order.payment_method)}
                    </span>
                  </div>
                </div>

                {/* Items */}
                <div className="bg-yellow-50 rounded-lg p-3 mb-3 border-2 border-yellow-200">
                  <h3 className={`font-black ${fullscreenMode ? "text-lg" : "text-sm"} mb-2 text-gray-800`}>
                    📋 ORDER ITEMS:
                  </h3>
                  <ul className="space-y-2">
                    {items.map((item, i) => {
                      const addons = item.addons || item.add_ons || [];
                      return (
                        <li
                          key={i}
                          className="border-b border-yellow-200 pb-2 last:border-b-0"
                        >
                          <div className="flex justify-between items-start">
                            <span className={`font-bold text-gray-800 ${fullscreenMode ? "text-base" : "text-sm"}`}>
                              {item.name}
                            </span>
                            <span className="bg-orange-500 text-white px-2 py-1 rounded-full text-xs font-black">
                              x{item.quantity}
                            </span>
                          </div>

                          {Array.isArray(item.sauces) && item.sauces.length > 0 && (
                            <div className="mt-1">
                              <p className={`font-bold text-gray-600 ${fullscreenMode ? "text-sm" : "text-xs"}`}>
                                🥫 Sauces:
                              </p>
                              <ul className={`ml-4 list-disc text-gray-700 ${fullscreenMode ? "text-sm" : "text-xs"}`}>
                                {item.sauces.map((s, idx) => (
                                  <li key={idx}>{s}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {Array.isArray(addons) && addons.length > 0 && (
                            <div className="mt-1">
                              <p className={`font-bold text-gray-600 ${fullscreenMode ? "text-sm" : "text-xs"}`}>
                                ➕ Add-ons:
                              </p>
                              <ul className={`ml-4 list-disc text-gray-700 ${fullscreenMode ? "text-sm" : "text-xs"}`}>
                                {addons.map((a, idx) => (
                                  <li key={idx}>{a}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {item.withSeasoning && (
                            <div className={`mt-1 bg-green-500 text-white px-2 py-1 rounded inline-block font-bold ${fullscreenMode ? "text-sm" : "text-xs"}`}>
                              ✨ WITH SEASONING
                            </div>
                          )}

                          {item.remarks?.trim() && (
                            <div className={`mt-2 bg-red-100 border-2 border-red-400 text-red-900 rounded px-2 py-2 font-bold ${fullscreenMode ? "text-sm" : "text-xs"}`}>
                              ⚠️ {item.remarks}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Total */}
                <div className="bg-gray-800 text-white rounded-lg p-3 mb-3 text-center">
                  <p className={`font-semibold opacity-80 ${fullscreenMode ? "text-base" : "text-xs"}`}>TOTAL</p>
                  <p className={`${fullscreenMode ? "text-4xl" : "text-2xl"} font-black`}>PKR {order.grand_total}</p>
                </div>

                {/* Status */}
                <div className="mb-3 text-center">
                  <span
                    className={`px-4 py-2 rounded-lg text-white font-black inline-block ${fullscreenMode ? "text-lg" : "text-sm"} ${
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
                    {order.status === "Confirmed" && "👨‍🍳 PUNCHING/ASSEMBLY"}
                    {order.status === "Cancelled" && "❌ CANCELLED"}
                  </span>
                </div>

                {/* Actions */}
                <div className={`grid gap-2 ${fullscreenMode ? "grid-cols-1" : "grid-cols-3"}`}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateOrderStatus(order.id, "Confirmed");
                    }}
                    disabled={order.status === "Confirmed"}
                    className={`bg-green-500 hover:bg-green-600 text-white px-2 py-3 rounded-lg font-bold disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors ${fullscreenMode ? "text-lg py-4" : "text-xs"}`}
                    title="Keyboard: 1 or !"
                  >
                    ✅ CONFIRM
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateOrderStatus(order.id, "Completed");
                    }}
                    className={`bg-blue-500 hover:bg-blue-600 text-white px-2 py-3 rounded-lg font-bold transition-colors ${fullscreenMode ? "text-lg py-4" : "text-xs"}`}
                    title="Keyboard: 2 or @"
                  >
                    🏁 COMPLETE
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateOrderStatus(order.id, "Cancelled");
                    }}
                    className={`bg-red-500 hover:bg-red-600 text-white px-2 py-3 rounded-lg font-bold transition-colors ${fullscreenMode ? "text-lg py-4" : "text-xs"}`}
                    title="Keyboard: 3 or #"
                  >
                    ❌ CANCEL
                  </button>
                </div>

                {/* 🎯 NEW: Keyboard shortcuts hint */}
                {isSelected && (
                  <div className="mt-3 bg-green-100 border border-green-400 rounded p-2 text-center">
                    <p className={`font-bold text-green-700 ${fullscreenMode ? "text-sm" : "text-xs"}`}>
                      ⌨️ Keys: 1/2/3 or ↑/↓
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Kitchen;
