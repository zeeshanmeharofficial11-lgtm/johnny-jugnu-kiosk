import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, Clock, MapPin, User, X } from 'lucide-react';
import html2canvas from "html2canvas";
import './App.css';

function App() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cart, setCart] = useState([]);
  const [activeCategory, setActiveCategory] = useState('mains');
  const [orderType, setOrderType] = useState('delivery');
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    address: '',
    instructions: ''
  });
  const [cashierInfo, setCashierInfo] = useState({
    name: '',
    id: '',
    password: ''
  });
  const [loginError, setLoginError] = useState(''); // shows invalid creds message
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [currentStep, setCurrentStep] = useState('cashier');
  const [deliveryCharges, setDeliveryCharges] = useState(0);
  const [orderNumber, setOrderNumber] = useState(null);

  // NEW: Branch selection state
  const BRANCHES = ["Phase 6", "Phase 4", "Johar Town", "Bahria Town", "Cloud Kitchen", "Emporium"];
  const [branch, setBranch] = useState(''); // kept across new orders for the logged-in cashier

  // NEW: Preset delivery locations (dropdown options)
const ADDRESS_OPTIONS = [
  { 
    value: 'P6 Branch to Lahore Garrison University (LGU) (Delivery Kiosk)', 
    label: 'P6 Branch to Lahore Garrison University (LGU) (Delivery Kiosk)' 
  },
  { 
    value: 'Cloud Kitchen to Alhamra Cultural Complex, Lahore  Goonj 2.0 Cultural Festival  (Delivery Kiosk)', 
    label: 'Cloud Kitchen to Alhamra Cultural Complex, Lahore  Goonj 2.0 Cultural Festival  (Delivery Kiosk)' 
  },
  { 
    value: 'EXE Not Working', 
    label: 'EXE Not Working' 
  },
];


  // Customization modal state
  const [showCustomizationModal, setShowCustomizationModal] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [selectedSauces, setSelectedSauces] = useState([]);
  const [selectedAddons, setSelectedAddons] = useState([]);

  // ---- Hardcoded credentials (for kiosk/dev only) ----
  const HARD_CODED_USERS = {
    spider: '9696',
    lupin: '9696',
    wehshi: '9696'
  };
  // ----------------------------------------------------

  // ======== LOGIN PERSISTENCE (localStorage) =========
  const SESSION_KEY = 'jj_kiosk_session';

  const saveSession = (stepOverride = null) => {
    const payload = {
      cashier: { name: cashierInfo.name || '', id: cashierInfo.id || '' },
      currentStep: stepOverride ?? currentStep,
      branch: branch || '',
      ts: Date.now()
    };
    // never store password
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  };

  const clearSession = () => {
    localStorage.removeItem(SESSION_KEY);
  };

  // Hydrate session on first load/refresh
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const sess = JSON.parse(raw);
      if (sess?.cashier?.id) {
        setCashierInfo(ci => ({ ...ci, name: sess.cashier.name || '', id: sess.cashier.id || '', password: '' }));
        // default to 'customer' if step is missing or invalid
        const step = ['cashier','customer','menu','confirm','receipt'].includes(sess.currentStep) ? sess.currentStep : 'customer';
        setCurrentStep(step);
      }
      if (sess?.branch) setBranch(sess.branch);
    } catch (e) {
      console.warn('Failed to parse saved session:', e);
    }
  }, []);

  // Helper to set step + persist
  const gotoStep = (step) => {
    setCurrentStep(step);
    setTimeout(() => saveSession(step), 0);
  };
  // ===================================================

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://lugtmmcpcgzyytkzqozn.supabase.co';
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Z3RtbWNwY2d6eXl0a3pxb3puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzODk0MDQsImV4cCI6MjA3NDk2NTQwNH0.uSEDsRNpH_QGwgGxrrxuYKCkuH3lszd8O9w7GN9INpE';

  const submitToSupabase = async (orderData) => {
    try {
      console.log('Order data ready for Supabase:', orderData);
      
      if (SUPABASE_URL === 'YOUR_SUPABASE_PROJECT_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
        console.log('⚠️ Supabase credentials not configured yet. Order data logged above.');
        return true;
      }
      
      const response = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          order_number: orderData.orderNumber,
          cashier_name: orderData.cashier.name,
          cashier_id: orderData.cashier.id,
          customer_name: orderData.customer.name,
          customer_phone: orderData.customer.phone,
          customer_address: orderData.customer.address,
          customer_instructions: orderData.customer.instructions,
          order_type: orderData.orderType,
          payment_method: orderData.paymentMethod,
          items: orderData.items,
          items_total: orderData.itemsTotal,
          delivery_charge: orderData.deliveryCharge,
          grand_total: orderData.grandTotal,
          status: orderData.status,
          estimated_time: orderData.estimatedTime,
          // NEW: branch (ensure your Supabase table has a 'branch' column)
          branch: orderData.branch
        })
      });
      
      if (response.ok || response.status === 201) {
        console.log('✅ Order successfully saved to Supabase database');
        return true;
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to save to Supabase:', response.status, errorText);
        return false;
      }
    } catch (error) {
      console.error('Error submitting to Supabase:', error);
      return false;
    }
  };

  // Available sauces for selection
  const availableSauces = [
    { id: 7, name: 'Jalapeno', image: '🌶️' },
    { id: 8, name: 'Atomic', image: '🔥' },
    { id: 9, name: 'Chipotle', image: '🌶️' },
    { id: 10, name: 'Garlic', image: '🧄' },
    { id: 11, name: 'Greek', image: '🫒' },
    { id: 12, name: 'Mushroom', image: '🍄' }
  ];

  // Available add-ons
  const availableAddons = [
    { id: 13, name: 'Mushrooms', price: 50, image: '🍄' },
    { id: 14, name: 'Jalapenos', price: 50, image: '🌶️' },
    { id: 15, name: 'Cheese', price: 50, image: '🧀' },
    { id: 16, name: 'Pickles', price: 50, image: '🥒' },
    { id: 17, name: 'Sweet Corn', price: 50, image: '🌽' },
    { id: 18, name: 'Extra Patty', price: 250, image: '🍖' }
  ];

  const menuData = {
    mains: [
      { id: 1, name: 'Tortilla Wrap', price: 1030, image: '🌯', category: 'mains', description: 'Chicken wrap in tortilla' },
      { id: 2, name: 'Smol Wrap', price: 730, image: '🌯', category: 'mains', description: 'Smaller chicken wrap' },
      { id: 3, name: 'Fillet', price: 830, image: '🍔', category: 'mains', description: 'Chicken fillet burger' },
      { id: 4, name: 'Wehshi', price: 830, image: '🍔', category: 'mains', description: 'Spicy chicken burger' },
      { id: 5, name: 'Nugg Wrap', price: 1030, image: '🌯', category: 'mains', description: 'Nuggets in tortilla wrap' },
      { id: 6, name: 'Smol Nugg Wrap', price: 730, image: '🌯', category: 'mains', description: 'Smaller nuggets wrap' }
    ],
    sauces: [
      { id: 7, name: 'Jalapeno', price: 0, image: '🌶️', category: 'sauces' },
      { id: 8, name: 'Atomic', price: 0, image: '🔥', category: 'sauces' },
      { id: 9, name: 'Chipotle', price: 0, image: '🌶️', category: 'sauces' },
      { id: 10, name: 'Garlic', price: 0, image: '🧄', category: 'sauces' },
      { id: 11, name: 'Greek', price: 0, image: '🫒', category: 'sauces' },
      { id: 12, name: 'Mushroom', price: 0, image: '🍄', category: 'sauces' }
    ],
    extras: [
      { id: 13, name: 'Mushrooms', price: 50, image: '🍄', category: 'extras', description: 'Fresh mushrooms' },
      { id: 14, name: 'Jalapenos', price: 50, image: '🌶️', category: 'extras', description: 'Spicy jalapenos' },
      { id: 15, name: 'Cheese', price: 50, image: '🧀', category: 'extras', description: 'Extra cheese slice' },
      { id: 16, name: 'Pickles', price: 50, image: '🥒', category: 'extras', description: 'Tangy pickles' },
      { id: 17, name: 'Sweet Corn', price: 50, image: '🌽', category: 'extras', description: 'Sweet corn kernels' },
      { id: 18, name: 'Extra Patty', price: 250, image: '🍖', category: 'extras', description: 'Additional chicken patty' },
      { id: 19, name: 'Sauce Dip', price: 100, image: '🥄', category: 'extras', description: 'Extra sauce portion' }
    ],
    meals: [
      { id: 20, name: 'Smol Meal', price: 350, withSeasoning: 360, image: '🍟', category: 'meals', description: 'With Seasoning' },
      { id: 21, name: 'Upsize Meal', price: 400, withSeasoning: 410, image: '🍟', category: 'meals', description: 'With Seasoning' },
      { id: 22, name: 'Nugg Meal', price: 730, withSeasoning: 740, image: '🍗', category: 'meals', description: 'With Seasoning' },
      { id: 23, name: 'Lemonade Meal', price: 400, image: '🥤', category: 'meals', description: 'Thirst Aid Or Thirst Aid Mint' },
      { id: 37, name: 'Smol Coke', price: 170, image: '🥤', category: 'meals', description: 'Only Drink if customer want' },
      { id: 38, name: 'Large Coke', price: 200, image: '🥤', category: 'meals', description: 'Only Drink if customer want' },
      { id: 39, name: 'Smol Sprite', price: 170, image: '🥤', category: 'meals', description: 'Only Drink if customer want' },
      { id: 40, name: 'Large Sprite', price: 200, image: '🥤', category: 'meals', description: 'Only Drink if customer want' },
      { id: 41, name: 'Water', price: 60, image: '💧', category: 'meals', description: 'Only Drink if customer want' }
    ],
    fries: [
      { id: 42, name: 'Smol Fries', price: 180, image: '🍟', category: 'fries', description: 'If customer want only fries' },
      { id: 43, name: 'Upsize Fries', price: 200, image: '🍟', category: 'fries', description: 'If customer want only fries' }
    ],
    wings: [
      { id: 24, name: 'Crispy Wings', price: 700, image: '🍗', category: 'wings', description: '8 Pieces + 1 Sauce' },
      { id: 25, name: 'Rami Wings', price: 750, image: '🍗', category: 'wings', description: '8 Pieces + Rami Sauce' },
      { id: 26, name: 'Gochu Wings', price: 750, image: '🍗', category: 'wings', description: '8 Pieces + Gochujang Sauce' }
    ],
    nuggets: [
      { id: 27, name: 'Nuggs (3 Pieces)', price: 330, image: '🍗', category: 'nuggets' },
      { id: 28, name: 'Nuggs (6 Pieces)', price: 610, image: '🍗', category: 'nuggets' },
      { id: 29, name: 'Rami Nuggs (6 Pieces)', price: 610, image: '🍗', category: 'nuggets' },
      { id: 30, name: 'Balti', price: 2700, image: '🍗', category: 'nuggets', description: '36 Nuggs, 5 Sauces' }
    ],
    lemonades: [
      { id: 31, name: 'Wildberry', price: 400, image: '🥤', category: 'lemonades' },
      { id: 32, name: 'Golden Hour', price: 400, image: '🥤', category: 'lemonades' },
      { id: 33, name: 'Slurp', price: 400, image: '🥤', category: 'lemonades' },
      { id: 34, name: 'Thirst Aid', price: 200, image: '🥤', category: 'lemonades' },
      { id: 35, name: 'Thirst Aid Mint', price: 200, image: '🥤', category: 'lemonades' },
      { id: 36, name: 'Sunset', price: 400, image: '🥤', category: 'lemonades' }
    ]
  };

  const categories = [
    { id: 'mains', name: 'Mains', icon: '🌯' },
    { id: 'sauces', name: 'Sauces', icon: '🌶️' },
    { id: 'extras', name: 'Extras', icon: '🧀' },
    { id: 'meals', name: 'Meals', icon: '🍟' },
    { id: 'fries', name: 'Fries', icon: '🍟' },
    { id: 'wings', name: 'Wings', icon: '🍗' },
    { id: 'nuggets', name: 'Nuggets', icon: '🍗' },
    { id: 'lemonades', name: 'Lemonades', icon: '🥤' }
  ];

  // ---- Login handler using hardcoded creds ----
  const handleLogin = () => {
    const enteredId = (cashierInfo.id || '').trim().toLowerCase();
    const enteredPassword = (cashierInfo.password || '').toString();

    if (!enteredId || !enteredPassword) {
      setLoginError('Please enter both Cashier ID and Password.');
      return;
    }

    if (HARD_CODED_USERS[enteredId] && HARD_CODED_USERS[enteredId] === enteredPassword) {
      setLoginError('');
      if (!cashierInfo.name || cashierInfo.name.trim() === '') {
        const displayName = enteredId.charAt(0).toUpperCase() + enteredId.slice(1);
        setCashierInfo(ci => ({ ...ci, name: displayName }));
      }
      setCashierInfo(ci => ({ ...ci, password: '' }));
      setTimeout(() => saveSession('customer'), 0);
      gotoStep('customer');
    } else {
      setLoginError('Invalid cashier ID or password.');
    }
  };
  // ----------------------------------------------------

  // Open customization modal for mains items
  const openCustomizationModal = (item) => {
    setCurrentItem(item);
    setSelectedSauces([]);
    setSelectedAddons([]);
    setShowCustomizationModal(true);
  };

  // --- Sauces: allow duplicates (max 2) ---
  const addSauce = (sauce) => {
    if (selectedSauces.length >= 2) {
      alert("You can only select 2 sauces total");
      return;
    }
    setSelectedSauces([...selectedSauces, sauce]); // push duplicate allowed
  };

  const removeSauceAt = (idx) => {
    const next = [...selectedSauces];
    next.splice(idx, 1);
    setSelectedSauces(next);
  };

  const sauceCount = (sauceId) => selectedSauces.filter((s) => s.id === sauceId).length;

  // Add-ons toggle (no duplicates)
  const toggleAddon = (addon) => {
    if (selectedAddons.find(a => a.id === addon.id)) {
      setSelectedAddons(selectedAddons.filter(a => a.id !== addon.id));
    } else {
      setSelectedAddons([...selectedAddons, addon]);
    }
  };

  const getCustomizedPrice = () => {
    const addonsTotal = selectedAddons.reduce((sum, addon) => sum + addon.price, 0);
    return currentItem.price + addonsTotal;
  };

  const addCustomizedToCart = () => {
    if (selectedSauces.length !== 2) {
      alert('Please select exactly 2 sauces');
      return;
    }

    const cartItem = {
      ...currentItem,
      cartId: Date.now() + Math.random(),
      quantity: 1,
      finalPrice: getCustomizedPrice(),
      sauces: selectedSauces, // duplicates preserved
      addons: selectedAddons,
      remarks: ''
    };
    
    setCart([...cart, cartItem]);
    setShowCustomizationModal(false);
    setCurrentItem(null);
    setSelectedSauces([]);
    setSelectedAddons([]);
  };

  const addToCart = (item, customizations = {}) => {
    if (item.category === 'mains') {
      openCustomizationModal(item);
      return;
    }

    const cartItem = {
      ...item,
      ...customizations,
      cartId: Date.now() + Math.random(),
      quantity: 1,
      finalPrice: customizations.withSeasoning || item.price,
      remarks: ''
    };
    setCart([...cart, cartItem]);
  };

  const updateRemarks = (cartId, remarks) => {
    setCart(cart.map(item => 
      item.cartId === cartId ? { ...item, remarks } : item
    ));
  };

  const updateQuantity = (cartId, newQuantity) => {
    if (newQuantity === 0) {
      removeFromCart(cartId);
      return;
    }
    setCart(cart.map(item => 
      item.cartId === cartId ? { ...item, quantity: newQuantity } : item
    ));
  };

  const removeFromCart = (cartId) => {
    setCart(cart.filter(item => item.cartId !== cartId));
  };

  const getTotalPrice = () => {
    const itemsTotal = cart.reduce((total, item) => total + (item.finalPrice * item.quantity), 0);
    return itemsTotal + deliveryCharges;
  };

  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const submitOrder = async () => {
  setIsSubmitting(true); // show loading

  const newOrderNumber = Math.floor(Math.random() * 10000);
  setOrderNumber(newOrderNumber);

  const orderData = {
    orderNumber: newOrderNumber,
    timestamp: new Date().toISOString(),
    cashier: { name: cashierInfo.name, id: cashierInfo.id },
    customer: customerInfo,
    orderType,
    paymentMethod,
    branch,
    items: cart.map(item => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.finalPrice,
      totalPrice: item.finalPrice * item.quantity,
      withSeasoning: !!item.withSeasoning,
      category: item.category,
      sauces: item.sauces ? item.sauces.map(s => s.name) : [],
      addons: item.addons ? item.addons.map(a => a.name) : [],
      remarks: item.remarks || ''
    })),
    itemsTotal: cart.reduce((t, i) => t + (i.finalPrice * i.quantity), 0),
    deliveryCharge: deliveryCharges,
    grandTotal: getTotalPrice(),
    status: 'Pending',
    estimatedTime: '15-20 minutes'
  };

  console.log('Order submitted:', orderData);

  const supabaseSuccess = await submitToSupabase(orderData);
  setIsSubmitting(false); // hide loading when done

  if (!supabaseSuccess) {
    alert('Warning: Order not saved to database. Please check your internet connection or contact support.');
  }

  saveSession('receipt');
  gotoStep('receipt');
};


  const printOrder = () => {
    window.print();
  };

  const downloadReceiptAsImage = async () => {
    try {
      const receiptElement = document.getElementById("receipt");
      if (!receiptElement) {
        alert("Receipt not found");
        return;
      }

      const canvas = await html2canvas(receiptElement, {
        scale: 2,
        useCORS: true
      });

      const link = document.createElement("a");
      link.download = `JJ_Order_${orderNumber}_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("Error capturing receipt:", error);
      alert("Failed to download receipt. Try printing instead.");
    }
  };

  const startNewOrder = () => {
    setCart([]);
    setCustomerInfo({ name: '', phone: '', address: '', instructions: '' });
    // Keep cashier and branch for next order, but clear password
    setCashierInfo(ci => ({ name: ci.name, id: ci.id, password: '' }));
    setPaymentMethod('cash');
    setDeliveryCharges(0);
    setActiveCategory('mains');
    setOrderNumber(null);
    setLoginError('');
    saveSession('customer');
    gotoStep('customer');
  };

  const logout = () => {
    setCart([]);
    setCustomerInfo({ name: '', phone: '', address: '', instructions: '' });
    setCashierInfo({ name: '', id: '', password: '' });
    setPaymentMethod('cash');
    setDeliveryCharges(0);
    setActiveCategory('mains');
    setOrderNumber(null);
    setLoginError('');
    setBranch(''); // clear branch on logout
    clearSession();
    gotoStep('cashier');
  };

  const MenuItemCard = ({ item }) => (
    <div className="bg-white rounded-lg shadow-md p-3 hover:shadow-lg transition-shadow">
      <div className="flex items-center gap-3">
        <div className="text-3xl">{item.image}</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base mb-1 truncate">{item.name}</h3>
          {item.description && (
            <p className="text-xs text-gray-600 mb-1 line-clamp-2">{item.description}</p>
          )}
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-orange-600">PKR {item.price}</span>
            {item.withSeasoning && (
              <span className="text-xs text-gray-500">+{item.withSeasoning} w/ seasoning</span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1 ml-2">
          <button
            onClick={() => addToCart(item)}
            className="w-8 h-8 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-colors flex items-center justify-center"
            title={item.category === 'mains' ? 'Customize & Add' : 'Add to cart'}
          >
            <Plus size={16} />
          </button>
          {item.withSeasoning && (
            <button
              onClick={() => addToCart(item, { withSeasoning: item.withSeasoning })}
              className="w-8 h-8 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors flex items-center justify-center text-xs"
              title="Add with seasoning"
            >
              +S
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // Customization Modal Component
  const CustomizationModal = () => {
    if (!showCustomizationModal || !currentItem) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">{currentItem.image} {currentItem.name}</h2>
              <p className="text-sm opacity-90">Customize your order</p>
            </div>
            <button
              onClick={() => setShowCustomizationModal(false)}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2"
            >
              <X size={24} />
            </button>
          </div>

          <div className="p-6">
            {/* Select Sauces (duplicates allowed) */}
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm">
                  {selectedSauces.length}/2 Selected
                </span>
                Select 2 Sauces (Duplicates Allowed)
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {availableSauces.map((sauce) => {
                  const count = sauceCount(sauce.id);
                  const atLimit = selectedSauces.length >= 2;
                  return (
                    <button
                      key={sauce.id}
                      onClick={() => addSauce(sauce)}
                      disabled={atLimit}
                      className={`relative p-3 rounded-lg border-2 transition-all ${
                        count > 0 ? 'border-orange-500 bg-orange-50 shadow-md' : 'border-gray-300 hover:border-orange-300'
                      } ${atLimit ? 'opacity-60 cursor-not-allowed' : ''}`}
                      title={atLimit ? 'Maximum 2 sauces selected' : 'Add sauce'}
                    >
                      <div className="text-3xl mb-1">{sauce.image}</div>
                      <div className="text-sm font-semibold">{sauce.name}</div>
                      {count > 0 && (
                        <span className="absolute top-2 right-2 text-xs font-black bg-orange-600 text-white px-2 py-0.5 rounded-full">
                          x{count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selected list with quick remove */}
              {selectedSauces.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedSauces.map((s, idx) => (
                    <span
                      key={`${s.id}-${idx}`}
                      className="inline-flex items-center gap-2 bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-semibold"
                    >
                      {s.name}
                      <button
                        onClick={() => removeSauceAt(idx)}
                        className="bg-orange-600 text-white rounded-full px-1 leading-none"
                        title="Remove"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Select Add-ons */}
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-3">Add-ons (Optional)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableAddons.map(addon => (
                  <button
                    key={addon.id}
                    onClick={() => toggleAddon(addon)}
                    className={`p-3 rounded-lg border-2 transition-all flex items-center gap-3 ${
                      selectedAddons.find(a => a.id === addon.id)
                        ? 'border-green-500 bg-green-50 shadow-md'
                        : 'border-gray-300 hover:border-green-300'
                    }`}
                  >
                    <div className="text-2xl">{addon.image}</div>
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-sm">{addon.name}</div>
                      <div className="text-xs text-gray-600">+PKR {addon.price}</div>
                    </div>
                    {selectedAddons.find(a => a.id === addon.id) && (
                      <div className="text-green-600 font-bold">✓</div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Summary */}
            <div className="bg-gray-100 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm">Base Price:</span>
                <span className="font-semibold">PKR {currentItem.price}</span>
              </div>
              {selectedAddons.length > 0 && (
                <div className="space-y-1 mb-2">
                  {selectedAddons.map(addon => (
                    <div key={addon.id} className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">{addon.name}:</span>
                      <span className="text-gray-600">+PKR {addon.price}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-t pt-2 flex justify-between items-center">
                <span className="text-lg font-bold">Total:</span>
                <span className="text-2xl font-black text-orange-600">PKR {getCustomizedPrice()}</span>
              </div>
            </div>

            {/* Add to Cart Button */}
            <button
              onClick={addCustomizedToCart}
              disabled={selectedSauces.length !== 2}
              className="w-full bg-orange-500 text-white py-4 rounded-lg font-bold text-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {selectedSauces.length !== 2 
                ? `Please select ${2 - selectedSauces.length} more sauce(s)` 
                : 'Add to Cart'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Cashier Information Step
  if (currentStep === 'cashier') {
    return (
      <div className="max-w-md mx-auto p-4 bg-gray-50 min-h-screen flex items-center">
        <div className="w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">JOHNNY & JUGNU</h1>
            <p className="text-gray-600">Order Kiosk System</p>
          </div>
          
          <h2 className="text-xl font-semibold mb-6 text-center flex items-center justify-center gap-2">
            <User className="text-blue-500" />
            Cashier Login
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Cashier Name *</label>
              <input
                type="text"
                value={cashierInfo.name}
                onChange={(e) => setCashierInfo({...cashierInfo, name: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Enter your display name (optional)"
              />
            </div>
            
            <div>
<<<<<<< HEAD
              <label className="block text-sm font-medium mb-2">Cashier ID *</label>
              <input
                type="text"
                value={cashierInfo.id}
                onChange={(e) => setCashierInfo({...cashierInfo, id: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="e.g., spider, lupin, wehshi"
                required
              />
            </div>
=======
  <label className="block text-sm font-medium mb-2">Cashier User *</label>
  <select
    value={cashierInfo.id}
    onChange={(e) => {
      const loginId = e.target.value;
      const users = adminConfig.users || [];
>>>>>>> e91c3aa44718bf497beb1bb473f2de96f6deaac0

            <div>
              <label className="block text-sm font-medium mb-2">Password *</label>
              <input
                type="password"
                value={cashierInfo.password}
                onChange={(e) => setCashierInfo({...cashierInfo, password: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Enter password"
                required
              />
            </div>

            {loginError && (
              <div className="text-sm text-red-600 font-semibold">
                {loginError}
              </div>
            )}
          </div>
          
          <button
            onClick={handleLogin}
            className="w-full mt-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-semibold"
          >
            Continue to Customer Details
          </button>
        </div>
      </div>
    );
  }

  // Customer Information Step
  if (currentStep === 'customer') {
    return (
      <div className="max-w-4xl mx-auto p-4 bg-gray-50 min-h-screen">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">JOHNNY & JUGNU</h1>
            <p className="text-sm text-gray-600">
              Cashier: {cashierInfo.name} (ID: {cashierInfo.id})
            </p>
          </div>
          
          <h2 className="text-2xl font-bold mb-6 text-center">Customer Information</h2>
          
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Order Type</label>
            <div className="flex gap-4">
              <button
                onClick={() => setOrderType('delivery')}
                className={`flex-1 py-3 rounded-lg border-2 flex items-center justify-center gap-2 ${
                  orderType === 'delivery' ? 'border-orange-500 bg-orange-50' : 'border-gray-300'
                }`}
              >
                <MapPin size={20} />
                Delivery
              </button>
              <button
                onClick={() => setOrderType('pickup')}
                className={`flex-1 py-3 rounded-lg border-2 flex items-center justify-center gap-2 ${
                  orderType === 'pickup' ? 'border-orange-500 bg-orange-50' : 'border-gray-300'
                }`}
              >
                <Clock size={20} />
                Pickup
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Customer Name *</label>
              <input
                type="text"
                value={customerInfo.name}
                onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Phone Number *</label>
              <input
                type="tel"
                value={customerInfo.phone}
                onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* NEW: Branch Dropdown */}
          <div className="mt-4">
            <label className="block text-sm font-medium mb-2">Branch *</label>
            <select
              value={branch}
              onChange={(e) => { setBranch(e.target.value); saveSession(); }}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              required
            >
              <option value="" disabled>Select branch</option>
              {BRANCHES.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {orderType === 'delivery' && (
  <div className="mt-4">
    <label className="block text-sm font-medium mb-2">Delivery Location *</label>
    <select
      value={customerInfo.address}
      onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
      required
    >
      <option value="" disabled>Select location</option>
      {ADDRESS_OPTIONS.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
)}



          <div className="mt-4">
            <label className="block text-sm font-medium mb-2">Instructions/Manual Address (If EXE Not Working)</label>
            <textarea
              value={customerInfo.instructions}
              onChange={(e) => setCustomerInfo({...customerInfo, instructions: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              rows="3"
            />
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium mb-2">Payment Method</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={() => setPaymentMethod('cash')}
                className={`py-3 rounded-lg border-2 flex items-center justify-center gap-2 ${
                  paymentMethod === 'cash' ? 'border-green-500 bg-green-50' : 'border-gray-300'
                }`}
              >
                <span className="text-xl">💰</span>
                <span className="text-sm font-medium">Cash</span>
              </button>
              <button
                onClick={() => setPaymentMethod('credit')}
                className={`py-3 rounded-lg border-2 flex items-center justify-center gap-2 ${
                  paymentMethod === 'credit' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                }`}
              >
                <span className="text-xl">💳</span>
                <span className="text-sm font-medium">Credit Card</span>
              </button>
              <button
                onClick={() => setPaymentMethod('online')}
                className={`py-3 rounded-lg border-2 flex items-center justify-center gap-2 ${
                  paymentMethod === 'online' ? 'border-purple-500 bg-purple-50' : 'border-gray-300'
                }`}
              >
                <span className="text-xl">📱</span>
                <span className="text-sm font-medium">Online</span>
              </button>
              {/* NEW: Marketing PR Tab */}
              <button
                onClick={() => setPaymentMethod('marketing')}
                className={`py-3 rounded-lg border-2 flex items-center justify-center gap-2 ${
                  paymentMethod === 'marketing' ? 'border-pink-500 bg-pink-50' : 'border-gray-300'
                }`}
              >
                <span className="text-xl">📣</span>
                <span className="text-sm font-medium">Marketing PR Tab</span>
              </button>
            </div>
          </div>

          <div className="mt-6 flex gap-4">
            <button
              onClick={() => gotoStep('cashier')}
              className="flex-1 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            >
              Back
            </button>
            <button
              onClick={() => { saveSession('menu'); gotoStep('menu'); }}
              disabled={!customerInfo.name || !customerInfo.phone || !branch || (orderType === 'delivery' && !customerInfo.address)}
              className="flex-1 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300"
            >
              Continue to Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Receipt Step
  if (currentStep === 'receipt') {
    return (
      <div className="max-w-md mx-auto p-4 bg-white min-h-screen print:shadow-none" id="receipt">
        {/* Header */}
        <div className="text-center border-b-4 border-double border-black pb-4 mb-6">
          <h1 className="text-3xl font-black text-black mb-2">JOHNNY & JUGNU</h1>
          <p className="text-base font-bold text-gray-800">OFFICIAL RECEIPT</p>
          <div className="bg-white text-black px-4 py-2 mt-3 inline-block rounded">
            <p className="text-xl font-black">ORDER #JJ{orderNumber}</p>
          </div>
          <p className="text-sm font-semibold mt-2">{new Date().toLocaleString()}</p>
        </div>

        {/* Staff & Customer Info */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-50 p-3 rounded-lg border-2 border-blue-200">
            <h3 className="font-black text-blue-800 mb-2 text-sm">CASHIER DETAILS</h3>
            <p className="text-xs font-bold">Name: {cashierInfo.name}</p>
            <p className="text-xs font-bold">ID: {cashierInfo.id}</p>
            <p className="text-xs font-bold">Branch: {branch || '—'}</p>
          </div>
          <div className="bg-green-50 p-3 rounded-lg border-2 border-green-200">
            <h3 className="font-black text-green-800 mb-2 text-sm">CUSTOMER INFO</h3>
            <p className="text-xs font-bold">Name: {customerInfo.name}</p>
            <p className="text-xs font-bold">Phone: {customerInfo.phone}</p>
          </div>
        </div>

        {/* Order Details */}
        <div className="bg-orange-50 p-3 rounded-lg border-2 border-orange-200 mb-6">
          <div className="grid grid-cols-2 gap-2 text-xs font-bold">
            <p>Type: <span className="text-orange-800">{orderType.toUpperCase()}</span></p>
            <p>Payment: <span className="text-orange-800">{
              paymentMethod === 'cash' ? 'CASH' :
              paymentMethod === 'credit' ? 'CREDIT CARD' :
              paymentMethod === 'online' ? 'ONLINE PAYMENT' :
              paymentMethod === 'marketing' ? 'MARKETING PR TAB' : (paymentMethod || '').toUpperCase()
            }</span></p>
            {orderType === 'delivery' && customerInfo.address && (
              <p className="col-span-2">Address: <span className="text-orange-800">{customerInfo.address}</span></p>
            )}
            {customerInfo.instructions && (
              <p className="col-span-2">Instructions: <span className="text-orange-800">{customerInfo.instructions}</span></p>
            )}
          </div>
        </div>

        {/* Order Items */}
        <div className="border-4 border-double border-black p-4 mb-6">
          <h3 className="font-black text-lg mb-4 text-center bg-black text-white py-2 -mx-4 -mt-4 mb-4">ORDER ITEMS</h3>
          {cart.map((item, index) => (
            <div key={index} className="mb-4 pb-3 border-b-2 border-dashed border-gray-400 last:border-b-0">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <p className="font-black text-base">{item.name}</p>

                  {item.withSeasoning && (
                    <span className="bg-green-500 text-white px-2 py-1 text-xs font-bold rounded">
                      WITH SEASONING
                    </span>
                  )}

                  <div className="flex items-center gap-2 mt-1">
                    <span className="bg-blue-500 text-white px-2 py-1 text-xs font-bold rounded">QTY: {item.quantity}</span>
                    <span className="text-sm font-bold">× PKR {item.finalPrice}</span>
                  </div>

                  {item.sauces && item.sauces.length > 0 && (
                    <div className="mt-1 text-xs text-blue-700">
                      Sauces: {item.sauces.map((sauce) =>
                        typeof sauce === "string" ? sauce : sauce.name
                      ).join(", ")}
                    </div>
                  )}

                  {item.addons && item.addons.length > 0 && (
                    <div className="mt-1 text-xs text-green-700">
                      Add-ons: {item.addons.map((addon) =>
                        typeof addon === "string" ? addon : addon.name
                      ).join(", ")}
                    </div>
                  )}

                  {item.remarks && (
                    <div className="mt-2 bg-yellow-100 p-2 rounded border border-yellow-400">
                      <p className="text-xs font-bold text-yellow-800">REMARKS: {item.remarks}</p>
                    </div>
                  )}
                </div>

                <div className="text-right ml-2">
                  <p className="font-black text-lg">PKR {item.finalPrice * item.quantity}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="bg-gray-100 p-4 rounded-lg border-4 border-double border-gray-800 mb-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center text-base font-bold">
              <span>SUBTOTAL:</span>
              <span>PKR {cart.reduce((total, item) => total + (item.finalPrice * item.quantity), 0)}</span>
            </div>
            {deliveryCharges > 0 && (
              <div className="flex justify-between items-center text-base font-bold text-blue-600">
                <span>DELIVERY CHARGES:</span>
                <span>PKR {deliveryCharges}</span>
              </div>
            )}
            <div className="border-t-4 border-double border-black pt-2 mt-3">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-black">GRAND TOTAL:</span>
                <span className="text-2xl font-black bg-black text-white px-4 py-2 rounded">PKR {getTotalPrice()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center border-4 border-double border-black p-4 mb-6">
          <p className="font-black text-lg mb-2">THANK YOU FOR YOUR ORDER!</p>
          <p className="font-bold text-base text-orange-600">Estimated Time: 15-20 minutes</p>
          <p className="text-xs font-bold mt-2 text-gray-600">Order saved to system database</p>
        </div>

        <div className="flex gap-2 print:hidden">
          <button
            onClick={printOrder}
            className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold"
          >
            🖨️ PRINT
          </button>
          <button
            onClick={downloadReceiptAsImage}
            className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold"
          >
            💾 DOWNLOAD
          </button>
          <button
            onClick={startNewOrder}
            className="flex-1 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-bold"
          >
            ➕ NEW ORDER
          </button>
        </div>

        <style jsx>{`
          @media print {
            body { margin: 0; }
            #receipt { box-shadow: none !important; }
            .print\\:hidden { display: none !important; }
            .print\\:shadow-none { box-shadow: none !important; }
          }
        `}</style>
      </div>
    );
  }

  // Order Confirmation Step
  if (currentStep === 'confirm') {
    return (
      <div className="max-w-4xl mx-auto p-4 bg-gray-50 min-h-screen">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-6 text-center">Order Confirmation</h2>
          
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Cashier Details</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p><strong>Cashier:</strong> {cashierInfo.name}</p>
                <p><strong>ID:</strong> {cashierInfo.id}</p>
                <p><strong>Branch:</strong> {branch || '—'}</p>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Customer Details</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p><strong>Name:</strong> {customerInfo.name}</p>
                <p><strong>Phone:</strong> {customerInfo.phone}</p>
                <p><strong>Order Type:</strong> {orderType}</p>
                <p><strong>Payment Method:</strong> {
                  paymentMethod === 'cash' ? 'Cash' :
                  paymentMethod === 'credit' ? 'Credit Card' :
                  paymentMethod === 'online' ? 'Online Payment' :
                  paymentMethod === 'marketing' ? 'Marketing PR Tab' : paymentMethod
                }</p>
                {orderType === 'delivery' && <p><strong>Address:</strong> {customerInfo.address}</p>}
                {customerInfo.instructions && <p><strong>Instructions:</strong> {customerInfo.instructions}</p>}
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">Order Items & Remarks</h3>
            <div className="space-y-4">
              {cart.map(item => (
                <div key={item.cartId} className="bg-gray-50 p-4 rounded-lg border">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex-1">
                      <span className="font-medium text-base">{item.name}</span>
                      {item.withSeasoning && <span className="text-sm text-green-600 ml-2 bg-green-100 px-2 py-1 rounded">(With Seasoning)</span>}
                      <span className="text-sm text-gray-600 ml-2 bg-blue-100 px-2 py-1 rounded">x{item.quantity}</span>
                    </div>
                    <span className="font-semibold text-lg">PKR {item.finalPrice * item.quantity}</span>
                  </div>
                  <div className="mt-3">
                    <label className="block text-sm font-medium mb-2">Remarks (Optional - e.g., No lettuce, Extra sauce, etc.):</label>
                    <input
                      type="text"
                      value={item.remarks}
                      onChange={(e) => updateRemarks(item.cartId, e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                      placeholder="Enter special instructions for this item..."
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery Charges */}
          <div className="mb-6 bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
            <h3 className="text-lg font-semibold mb-4">Delivery Charges</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setDeliveryCharges(0)}
                  className={`px-4 py-2 rounded-lg border-2 font-semibold ${
                    deliveryCharges === 0 ? 'border-green-500 bg-green-100 text-green-800' : 'border-gray-300'
                  }`}
                >
                  No Delivery Charges (PKR 0)
                </button>
                <button
                  onClick={() => setDeliveryCharges(100)}
                  className={`px-4 py-2 rounded-lg border-2 font-semibold ${
                    deliveryCharges === 100 ? 'border-orange-500 bg-orange-100 text-orange-800' : 'border-gray-300'
                  }`}
                >
                  Standard Delivery (PKR 100)
                </button>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Custom Amount:</label>
                <input
                  type="number"
                  value={deliveryCharges}
                  onChange={(e) => setDeliveryCharges(parseInt(e.target.value) || 0)}
                  className="w-24 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  min="0"
                />
                <span className="text-sm text-gray-600">PKR</span>
              </div>
            </div>
          </div>

          <div className="border-t pt-4 mb-6">
            <div className="space-y-3 mb-4 bg-gray-100 p-4 rounded-lg">
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>Subtotal:</span>
                <span>PKR {cart.reduce((total, item) => total + (item.finalPrice * item.quantity), 0)}</span>
              </div>
              {deliveryCharges > 0 && (
                <div className="flex justify-between items-center text-lg font-semibold text-blue-600">
                  <span>Delivery Charges:</span>
                  <span>PKR {deliveryCharges}</span>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center text-2xl font-black bg-black text-white p-4 rounded-lg">
              <span>GRAND TOTAL:</span>
              <span>PKR {getTotalPrice()}</span>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <p className="text-sm text-blue-800 font-medium">
              📊 This order will be automatically saved to Supabase database (FREE cloud storage) for record keeping and kitchen management.
            </p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => { saveSession('menu'); gotoStep('menu'); }}
              className="flex-1 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            >
              Back to Menu
            </button>
                        <button
              onClick={submitOrder}
              disabled={isSubmitting}
              className={`flex-1 py-3 rounded-lg font-semibold text-white transition-colors ${
                isSubmitting
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600'
              }`}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 018 8h-4l3 3 3-3h-4a8 8 0 01-8 8v-4l-3 3 3 3v-4a8 8 0 01-8-8z"
                    ></path>
                  </svg>
                  Saving...
                </div>
              ) : (
                'Confirm Order & Save to System'
              )}
            </button>

          </div>
        </div>
      </div>
    );
  }

  // Main Menu Step
  if (currentStep === 'menu') {
    return (
      <>
        <CustomizationModal />
        <div className="max-w-7xl mx-auto p-4 bg-gray-50 min-h-screen">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-4xl font-bold text-gray-800 mb-2">JOHNNY & JUGNU</h1>
                <p className="text-gray-600">
                  Cashier: {cashierInfo.name} | Customer: {customerInfo.name} {branch ? `| Branch: ${branch}` : ''}
                </p>
              </div>
              <div className="relative">
                <button
                  onClick={() => cart.length > 0 && (saveSession('confirm'), gotoStep('confirm'))}
                  disabled={cart.length === 0}
                  className="flex items-center gap-3 bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 disabled:bg-gray-300 transition-colors"
                >
                  <ShoppingCart size={24} />
                  <div className="text-left">
                    <div className="font-semibold">PKR {getTotalPrice()}</div>
                    <div className="text-sm">{getTotalItems()} items</div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-4 gap-4 sm:gap-6">
            {/* Categories Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-lg p-3 sm:p-4 sticky top-4">
                <h3 className="font-bold text-base sm:text-lg mb-3 sm:mb-4">Categories</h3>
                <div className="space-y-1 sm:space-y-2">
                  {categories.map(category => (
                    <button
                      key={category.id}
                      onClick={() => setActiveCategory(category.id)}
                      className={`w-full text-left p-2 sm:p-3 rounded-lg transition-colors flex items-center gap-2 sm:gap-3 ${
                        activeCategory === category.id
                          ? 'bg-orange-500 text-white'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <span className="text-lg sm:text-xl">{category.icon}</span>
                      <span className="font-medium text-sm sm:text-base">{category.name}</span>
                    </button>
                  ))}
                </div>
                
                <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t">
                  <button
                    onClick={() => { saveSession('customer'); gotoStep('customer'); }}
                    className="w-full text-left p-2 sm:p-3 rounded-lg bg-blue-50 hover:bg-blue-100 flex items-center gap-2 sm:gap-3"
                  >
                    <User size={18} />
                    <span className="font-medium text-sm sm:text-base">Edit Customer Info</span>
                  </button>
                </div>

                <div className="mt-4">
                  <button
                    onClick={logout}
                    className="w-full text-left p-2 sm:p-3 rounded-lg bg-red-50 hover:bg-red-100 text-red-700"
                  >
                    Logout Cashier
                  </button>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
                <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 capitalize">
                  {categories.find(c => c.id === activeCategory)?.name}
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:gap-4">
                  {menuData[activeCategory]?.map(item => (
                    <MenuItemCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Cart Sidebar */}
          {cart.length > 0 && (
            <div className="fixed right-2 sm:right-4 top-4 w-72 sm:w-80 bg-white rounded-lg shadow-2xl p-3 sm:4 z-40 max-h-[90vh] overflow-y-auto">
              <h3 className="font-bold text-base sm:text-lg mb-3 sm:mb-4 flex items-center gap-2 sticky top-0 bg-white pb-2">
                <ShoppingCart size={18} />
                Current Order
              </h3>
              <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4">
                {cart.map(item => (
                  <div key={item.cartId} className="bg-gray-50 p-2 rounded border">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-xs sm:text-sm truncate">{item.name}</div>
                        {item.sauces && item.sauces.length > 0 && (
                          <div className="text-xs text-blue-600 mt-1">
                            Sauces: {item.sauces.map(s => (typeof s === 'string' ? s : s.name)).join(', ')}
                          </div>
                        )}
                        {item.addons && item.addons.length > 0 && (
                          <div className="text-xs text-green-600 mt-1">
                            Add-ons: {item.addons.map(a => (typeof a === 'string' ? a : a.name)).join(', ')}
                          </div>
                        )}
                        {item.withSeasoning && (
                          <div className="text-xs text-green-600 mt-1">With Seasoning</div>
                        )}
                        <div className="text-xs sm:text-sm font-semibold mt-1">PKR {item.finalPrice}</div>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => updateQuantity(item.cartId, item.quantity - 1)}
                          className="w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                        >
                          <Minus size={10} />
                        </button>
                        <span className="w-6 text-center text-xs">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.cartId, item.quantity + 1)}
                          className="w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center hover:bg-green-600"
                        >
                          <Plus size={10} />
                        </button>
                        <button
                          onClick={() => removeFromCart(item.cartId)}
                          className="ml-1 text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t pt-3 bg-white sticky bottom-0">
                <div className="flex justify-between font-bold text-base mb-3">
                  <span>Total:</span>
                  <span>PKR {getTotalPrice()}</span>
                </div>
                <button
                  onClick={() => { saveSession('confirm'); gotoStep('confirm'); }}
                  className="w-full bg-orange-500 text-white py-2 text-sm rounded-lg hover:bg-orange-600 transition-colors"
                >
                  Review Order
                </button>
              </div>
            </div>
          )}
        </div>
      </>
    );
  } // closes if (currentStep === 'menu')

} // closes function App

export default App;
