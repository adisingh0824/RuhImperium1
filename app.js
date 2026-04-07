// CORE STORE STORAGE SETUP
const CART_STORAGE_KEY = 'ruhImperiumCart';
const WISHLIST_STORAGE_KEY = 'ruhImperiumWishlist';
const USER_STORAGE_KEY = 'ruhImperiumUser';
const SESSION_STORAGE_KEY = 'ruhImperiumSession';
const COUPON_STORAGE_KEY = 'ruhImperiumCoupon';
const LOCAL_USERS_STORAGE_KEY = 'ruhImperiumLocalUsers';
const LOCAL_ORDERS_STORAGE_KEY = 'ruhImperiumLocalOrders';
const LOCAL_OTP_STORAGE_KEY = 'ruhImperiumPendingOtp';
const LOCAL_CHECKOUT_OTP_STORAGE_KEY = 'ruhImperiumPendingCheckoutOtp';
const RECENTLY_VIEWED_STORAGE_KEY = 'ruhImperiumRecentlyViewed';

const NEWSLETTER_STORAGE_KEY = 'ruhImperiumNewsletterSubscribers';
const SITE_TRAFFIC_STORAGE_KEY = 'ruhImperiumSiteTraffic';
const SITE_TRAFFIC_SESSION_KEY = 'ruhImperiumTrafficSession';
const REVIEW_STORAGE_KEY = 'ruhImperiumCustomerReviews';
const CURRENCY_STORAGE_KEY = 'ruhImperiumCurrency';
const SELLER_APPLICATIONS_STORAGE_KEY = 'ruhImperiumSellerApplications';
const SELLER_PRODUCTS_STORAGE_KEY = 'ruhImperiumSellerProducts';
const VIEW_SIGNALS_STORAGE_KEY = 'ruhImperiumViewSignals';
const ABANDONED_CART_STORAGE_KEY = 'ruhImperiumAbandonedCarts';
const STOCK_ALERTS_STORAGE_KEY = 'ruhImperiumStockAlerts';
// COUPON VALIDATION SETUP
const LOCAL_COUPONS = {
    RAMJI20: { code: 'RAMJI20', label: 'Ram Ji Signature Offer', type: 'percent', value: 20, expiresAt: '2027-03-31T23:59:59.000Z' },
    WELCOME10: { code: 'WELCOME10', label: 'Welcome Offer', type: 'percent', value: 10, expiresAt: '2027-03-31T23:59:59.000Z' },
    ATTAR250: { code: 'ATTAR250', label: 'Flat Rs. 250 Off', type: 'flat', value: 250, minOrder: 1500, expiresAt: '2027-03-31T23:59:59.000Z' }
};
const FALLBACK_ADMIN_EMAIL = 'sadityasingh7990@gmail.com';
const PARTIAL_COD_DEPOSIT_PERCENT = 20;
const ORIGIN_STATE = 'Uttar Pradesh';
const CATEGORY_GST_RATES = {
    'Discovery Set': 12,
    'Ruh / Absolute Oil': 18,
    'Authentic Indian Attars': 18,
    'Next Gen Fragrances': 18,
    'Modern Attars': 18,
    'Eau De Parfum': 18
};
const REMOTE_STATES = new Set(['West Bengal', 'Tamil Nadu', 'Karnataka', 'Maharashtra', 'Other']);

let cart = [];
let wishlist = [];
let currentFilter = 'all';
let maxPrice = 5000;
let sortMode = 'default';
let selectedPayment = 'Razorpay';
let currentProduct = null;
let currentUser = null;
let sessionToken = '';
let appliedCoupon = null;
let authMode = 'login';
let apiConfig = {
    backendReady: false,
    razorpayKeyId: '',
    adminEnabled: false,
    adminEmail: '',
    otpDelivery: 'preview',
    paymentEnabled: false,
    paymentReason: '',
    health: null
};
let orderHistory = [];
let adminOrderHistory = [];
let adminStats = null;
let adminSubscribers = [];
let adminFilterPreset = 'all';
let otpRequestedFor = '';
const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered'];
let recentlyViewed = [];
let selectedCurrency = 'INR';

const CURRENCY_RATES = {
    INR: 1,
    USD: 0.012,
    AED: 0.044,
    EUR: 0.011,
    GBP: 0.0094
};

const CURRENCY_SYMBOLS = {
    INR: '₹',
    USD: '$',
    AED: 'AED ',
    EUR: '€',
    GBP: '£'
};

// LOCAL STATE BOOTSTRAP SETUP
function loadStoredState() {
    try {
        cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
        wishlist = JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY) || '[]');
        currentUser = JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || 'null');
        sessionToken = localStorage.getItem(SESSION_STORAGE_KEY) || '';
        appliedCoupon = JSON.parse(localStorage.getItem(COUPON_STORAGE_KEY) || 'null');
        recentlyViewed = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY) || '[]');
        selectedCurrency = localStorage.getItem(CURRENCY_STORAGE_KEY) || guessCurrencyFromLocale();
    } catch (error) {
        cart = [];
        wishlist = [];
        currentUser = null;
        sessionToken = '';
        appliedCoupon = null;
        recentlyViewed = [];
        selectedCurrency = guessCurrencyFromLocale();
    }
    syncMarketplaceProducts();
}

// ADMIN ACCESS SETUP
function applyAdminAccess(user) {
    if (!user) return user;
    const adminEmail = String(apiConfig.adminEmail || FALLBACK_ADMIN_EMAIL).trim().toLowerCase();
    return {
        ...user,
        isAdmin: Boolean(adminEmail) && String(user.email || '').trim().toLowerCase() === adminEmail
    };
}

function updateStoredLocalUser(email, changes) {
    if (!email) return;
    const users = getLocalUsers().map(user =>
        String(user.email || '').trim().toLowerCase() === String(email).trim().toLowerCase()
            ? { ...user, ...changes }
            : user
    );
    saveLocalUsers(users);
}

function syncCurrentUserProfile(changes = {}) {
    if (!currentUser) return;
    currentUser = applyAdminAccess({ ...currentUser, ...changes });
    updateStoredLocalUser(currentUser.email, changes);
    persistUser();
}

function getApprovedSellerCatalogProducts() {
    return getSellerProducts()
        .filter(item => item.status === 'approved')
        .map(item => ({
            id: item.catalogId || Number(`9${String(item.id || '').replace(/\D/g, '').slice(-6) || Date.now()}`),
            name: item.name,
            img: item.image || 'gulabattar.png',
            cat: item.category || 'Seller Collection',
            notes: item.notes || 'Marketplace',
            price: Number(item.price || 0),
            oldPrice: item.oldPrice ? Number(item.oldPrice) : null,
            stars: Number(item.rating || 4.5),
            reviews: Number(item.reviews || 0),
            badge: item.badge || 'SELLER',
            sizes: item.sizes?.length ? item.sizes : ['Standard'],
            desc: item.description || `Submitted by ${item.sellerName || 'seller'} through the marketplace dashboard.`,
            tags: item.tags?.length ? item.tags : ['Marketplace'],
            sellerManaged: true,
            sellerEmail: item.sellerEmail,
            bestseller: false
        }));
}

function syncMarketplaceProducts() {
    for (let index = products.length - 1; index >= 0; index -= 1) {
        if (products[index]?.sellerManaged) {
            products.splice(index, 1);
        }
    }
    getApprovedSellerCatalogProducts().forEach(item => products.push(item));
}

function persistState() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlist));
    localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(appliedCoupon));
    localStorage.setItem(RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify(recentlyViewed));
    localStorage.setItem(CURRENCY_STORAGE_KEY, selectedCurrency);
}

function guessCurrencyFromLocale() {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || '';
    if (/en-AE|ar-AE/i.test(locale)) return 'AED';
    if (/en-US/i.test(locale)) return 'USD';
    if (/en-GB/i.test(locale)) return 'GBP';
    if (/de|fr|it|es|nl/i.test(locale)) return 'EUR';
    return 'INR';
}

function persistUser() {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
    if (sessionToken) localStorage.setItem(SESSION_STORAGE_KEY, sessionToken);
    else localStorage.removeItem(SESSION_STORAGE_KEY);
}

function clearUserState() {
    currentUser = null;
    sessionToken = '';
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(SESSION_STORAGE_KEY);
}

// LOCAL DATA HELPERS SETUP
function readLocalJson(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (error) {
        return fallback;
    }
}

function writeLocalJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function getLocalNewsletterSubscribers() {
    return readLocalJson(NEWSLETTER_STORAGE_KEY, []);
}

function saveLocalNewsletterSubscribers(subscribers) {
    writeLocalJson(NEWSLETTER_STORAGE_KEY, subscribers);
}

function getLocalUsers() {
    return readLocalJson(LOCAL_USERS_STORAGE_KEY, []);
}

function saveLocalUsers(users) {
    writeLocalJson(LOCAL_USERS_STORAGE_KEY, users);
}

function getLocalOrders() {
    return readLocalJson(LOCAL_ORDERS_STORAGE_KEY, []);
}

function saveLocalOrders(orders) {
    writeLocalJson(LOCAL_ORDERS_STORAGE_KEY, orders);
}

function getPendingLocalOtp() {
    return readLocalJson(LOCAL_OTP_STORAGE_KEY, null);
}

function savePendingLocalOtp(otp) {
    writeLocalJson(LOCAL_OTP_STORAGE_KEY, otp);
}

function clearPendingLocalOtp() {
    localStorage.removeItem(LOCAL_OTP_STORAGE_KEY);
}

function getPendingLocalCheckoutOtp() {
    return readLocalJson(LOCAL_CHECKOUT_OTP_STORAGE_KEY, null);
}

function savePendingLocalCheckoutOtp(otp) {
    writeLocalJson(LOCAL_CHECKOUT_OTP_STORAGE_KEY, otp);
}

function clearPendingLocalCheckoutOtp() {
    localStorage.removeItem(LOCAL_CHECKOUT_OTP_STORAGE_KEY);
}

// COUPON VALIDATION SETUP
function getLocalCoupon(code, subtotal) {
    const coupon = LOCAL_COUPONS[String(code || '').trim().toUpperCase()];
    if (!coupon) throw new Error('Invalid coupon code.');
    if (coupon.startsAt && new Date(coupon.startsAt).getTime() > Date.now()) {
        throw new Error('This coupon is not active yet.');
    }
    if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
        throw new Error('This coupon has expired.');
    }
    if (coupon.minOrder && subtotal < coupon.minOrder) {
        throw new Error(`Coupon works on orders above ₹${coupon.minOrder}.`);
    }
    const discountAmount = coupon.type === 'percent'
        ? Math.round(subtotal * (coupon.value / 100))
        : Math.min(coupon.value, subtotal);
    return { ...coupon, discountAmount, subtotal, finalTotal: Math.max(subtotal - discountAmount, 0) };
}

function getPartialCodAmounts(total) {
    const numericTotal = Number(total || 0);
    const deposit = Math.max(1, Math.round(numericTotal * (PARTIAL_COD_DEPOSIT_PERCENT / 100)));
    return {
        deposit,
        balance: Math.max(numericTotal - deposit, 0)
    };
}

function getLocalTrafficStats() {
    return readLocalJson(SITE_TRAFFIC_STORAGE_KEY, { totalVisits: 0, lastVisitAt: '' });
}

function saveLocalTrafficStats(stats) {
    writeLocalJson(SITE_TRAFFIC_STORAGE_KEY, stats);
}

function getStoredReviews() {
    return readLocalJson(REVIEW_STORAGE_KEY, []);
}

function saveStoredReviews(reviews) {
    writeLocalJson(REVIEW_STORAGE_KEY, reviews);
}

function getSellerApplications() {
    return readLocalJson(SELLER_APPLICATIONS_STORAGE_KEY, []);
}

function saveSellerApplications(applications) {
    writeLocalJson(SELLER_APPLICATIONS_STORAGE_KEY, applications);
}

function getSellerProducts() {
    return readLocalJson(SELLER_PRODUCTS_STORAGE_KEY, []);
}

function saveSellerProducts(items) {
    writeLocalJson(SELLER_PRODUCTS_STORAGE_KEY, items);
}

function getViewSignals() {
    return readLocalJson(VIEW_SIGNALS_STORAGE_KEY, []);
}

function saveViewSignals(items) {
    writeLocalJson(VIEW_SIGNALS_STORAGE_KEY, items);
}

function getAbandonedCarts() {
    return readLocalJson(ABANDONED_CART_STORAGE_KEY, []);
}

function saveAbandonedCarts(items) {
    writeLocalJson(ABANDONED_CART_STORAGE_KEY, items);
}

function getStockAlerts() {
    return readLocalJson(STOCK_ALERTS_STORAGE_KEY, []);
}

function saveStockAlerts(items) {
    writeLocalJson(STOCK_ALERTS_STORAGE_KEY, items);
}

function convertAmount(amount) {
    const rate = CURRENCY_RATES[selectedCurrency] || 1;
    return Number(amount || 0) * rate;
}

function formatCurrency(amount) {
    const converted = convertAmount(amount);
    const symbol = CURRENCY_SYMBOLS[selectedCurrency] || '₹';
    return `${symbol}${converted.toLocaleString(selectedCurrency === 'INR' ? 'en-IN' : 'en-US', {
        maximumFractionDigits: selectedCurrency === 'INR' ? 0 : 2
    })}`;
}

function registerSiteVisit() {
    const todayKey = new Date().toISOString().slice(0, 10);
    if (sessionStorage.getItem(SITE_TRAFFIC_SESSION_KEY) === todayKey) return;
    sessionStorage.setItem(SITE_TRAFFIC_SESSION_KEY, todayKey);
    const stats = getLocalTrafficStats();
    stats.totalVisits = Number(stats.totalVisits || 0) + 1;
    stats.lastVisitAt = new Date().toISOString();
    saveLocalTrafficStats(stats);
}

function buildLocalOrder(details, paymentMethod, paymentStatus, orderStatus) {
    const pricing = getOrderPricing();
    const partialCod = paymentMethod === 'Partial COD' ? getPartialCodAmounts(pricing.total) : { deposit: 0, balance: 0 };
    return {
        id: 'local-' + Date.now(),
        userId: currentUser?.id || currentUser?.email || 'guest',
        customerName: details.name,
        customerEmail: details.email,
        customerPhone: details.phone,
        shippingAddress: {
            address: details.address,
            city: details.city,
            state: details.state,
            pin: details.pin
        },
        items: cart.map(item => ({
            ...item,
            unitPrice: item.price,
            lineTotal: item.price * item.qty
        })),
        subtotal: pricing.subtotal,
        discount: pricing.discount,
        couponCode: appliedCoupon ? appliedCoupon.code : '',
        deliveryCharge: pricing.delivery,
        gstTotal: pricing.gstTotal,
        gstBreakdown: pricing.gstBreakdown,
        total: pricing.total,
        depositAmount: partialCod.deposit,
        balanceDue: partialCod.balance,
        paymentMethod,
        paymentStatus,
        orderStatus,
        trackingId: '',
        courierName: '',
        createdAt: new Date().toISOString()
    };
}

function saveLocalCodOrder(details) {
    const orders = getLocalOrders();
    orders.push(buildLocalOrder(details, 'COD', 'pending', 'pending'));
    saveLocalOrders(orders);
    launchWhatsAppOrder(details, 'Cash on Delivery');
    finalizeOrder('Order placed successfully with Cash on Delivery.');
}

function saveLocalPartialCodOrder(details, paymentId = '') {
    const orders = getLocalOrders();
    orders.push(buildLocalOrder(details, 'Partial COD', 'partial-paid', 'pending'));
    saveLocalOrders(orders);
    launchWhatsAppOrder(details, 'Partial COD', paymentId);
    const amounts = getPartialCodAmounts(getOrderPricing().total);
    finalizeOrder(`Partial COD booked. ₹${amounts.deposit.toLocaleString()} paid now, ₹${amounts.balance.toLocaleString()} due on delivery.`);
}

function buildLocalAdminSnapshot() {
    adminOrderHistory = getLocalOrders().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    adminSubscribers = getLocalNewsletterSubscribers()
        .map((email, index) => ({
            id: `local-sub-${index + 1}`,
            email,
            createdAt: new Date().toISOString()
        }))
        .sort((a, b) => a.email.localeCompare(b.email));
    adminStats = {
        totalOrders: adminOrderHistory.length,
        pendingOrders: adminOrderHistory.filter(order => (order.orderStatus || 'pending') === 'pending').length,
        shippedOrders: adminOrderHistory.filter(order => order.orderStatus === 'shipped').length,
        deliveredOrders: adminOrderHistory.filter(order => order.orderStatus === 'delivered').length,
        totalRevenue: adminOrderHistory.reduce((sum, order) => sum + Number(order.total || 0), 0),
        totalVisits: Number(getLocalTrafficStats().totalVisits || 0)
    };
}

function isRecoverableApiError(message) {
    const text = String(message || '').toLowerCase();
    return (
        !text ||
        /request failed/.test(text) ||
        /failed to fetch/.test(text) ||
        /internal server error/.test(text) ||
        /api route not found/.test(text) ||
        /network/.test(text) ||
        /unexpected token/.test(text)
    );
}

function buildOrderDocumentHtmlClient(order, type) {
    const title = type === 'packing-slip' ? 'Packing Slip' : 'Invoice';
    const address = order.shippingAddress || {};
    const rows = (order.items || []).map(item => type === 'packing-slip'
        ? `<tr><td>${item.name}</td><td>${item.size}</td><td>${item.qty}</td></tr>`
        : `<tr><td>${item.name}</td><td>${item.size}</td><td>${item.qty}</td><td>₹${Number(item.unitPrice || item.price || 0).toLocaleString()}</td><td>₹${Number(item.lineTotal || item.price * item.qty || 0).toLocaleString()}</td></tr>`
    ).join('');
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${title}</title><style>body{font-family:Arial,sans-serif;background:#eef3f9;margin:0;color:#162742}.sheet{max-width:900px;margin:24px auto;background:#fff;border:1px solid #d6e1ee;padding:32px;box-shadow:0 18px 50px rgba(17,34,55,0.08)}.top{display:flex;justify-content:space-between;gap:24px;margin-bottom:28px}.brand h1{margin:0;font-size:30px;color:#162742}.brand p,.meta p{margin:6px 0;color:#53657e;line-height:1.5}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.card{border:1px solid #dbe5f0;background:#f8fbff;padding:16px}.card p{margin:10px 0}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #dde6f0;padding:10px;text-align:left;font-size:14px}th{background:#edf4fb;color:#23415f}.summary{margin-top:20px;margin-left:auto;max-width:320px}.summary-line{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e0e8f1}.summary-line.total{font-size:18px;font-weight:700;border-bottom:none;color:#162742}@media print{body{background:#fff}.sheet{margin:0;border:none;box-shadow:none}}</style></head><body><div class="sheet"><div class="top"><div class="brand"><h1>Ruh Imperium</h1><p>Pure Indian Fragrances · Since 1973</p><p>Kannauj, Uttar Pradesh</p></div><div class="meta"><p><strong>${title}</strong></p><p>Order ID: ${order.id}</p><p>Date: ${formatDate(order.createdAt)}</p><p>Payment: ${order.paymentMethod} · ${order.paymentStatus}</p></div></div><div class="grid"><div class="card"><p><strong>${order.customerName}</strong></p><p>${order.customerEmail || ''}</p><p>${order.customerPhone || ''}</p></div><div class="card"><p>${address.address || ''}</p><p>${address.city || ''}, ${address.state || ''} - ${address.pin || ''}</p><p>Order Status: ${order.orderStatus || 'pending'}</p>${order.courierName ? `<p>Courier: ${order.courierName}</p>` : ''}${order.trackingId ? `<p>Tracking ID: ${order.trackingId}</p>` : ''}</div></div><table><thead>${type === 'packing-slip' ? '<tr><th>Item</th><th>Size</th><th>Qty</th></tr>' : '<tr><th>Item</th><th>Size</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>'}</thead><tbody>${rows}</tbody></table><div class="summary"><div class="summary-line"><span>Subtotal</span><strong>₹${Number(order.subtotal || 0).toLocaleString()}</strong></div>${type === 'packing-slip' ? `${order.courierName ? `<div class="summary-line"><span>Courier</span><strong>${order.courierName}</strong></div>` : ''}${order.trackingId ? `<div class="summary-line"><span>Tracking ID</span><strong>${order.trackingId}</strong></div>` : ''}` : `<div class="summary-line"><span>Coupon</span><strong>${order.couponCode || 'None'}</strong></div>${order.deliveryCharge ? `<div class="summary-line"><span>Delivery</span><strong>₹${Number(order.deliveryCharge || 0).toLocaleString()}</strong></div>` : ''}${order.gstBreakdown?.igst ? `<div class="summary-line"><span>IGST</span><strong>₹${Number(order.gstBreakdown.igst || 0).toLocaleString()}</strong></div>` : `<div class="summary-line"><span>CGST</span><strong>₹${Number(order.gstBreakdown?.cgst || 0).toLocaleString()}</strong></div><div class="summary-line"><span>SGST</span><strong>₹${Number(order.gstBreakdown?.sgst || 0).toLocaleString()}</strong></div>`}<div class="summary-line"><span>Discount</span><strong>₹${Number(order.discount || 0).toLocaleString()}</strong></div>${order.courierName ? `<div class="summary-line"><span>Courier</span><strong>${order.courierName}</strong></div>` : ''}${order.trackingId ? `<div class="summary-line"><span>Tracking ID</span><strong>${order.trackingId}</strong></div>` : ''}<div class="summary-line total"><span>Total</span><strong>₹${Number(order.total || 0).toLocaleString()}</strong></div>`}</div></div></body></html>`;
}

// BACKEND API COMMUNICATION SETUP
async function apiFetch(path, options = {}, needsAuth = false) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };
    if (needsAuth && sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
    let response;
    try {
        response = await fetch(path, { ...options, headers });
    } catch (error) {
        if (String(path || '').startsWith('/api/')) {
            apiConfig = { ...apiConfig, backendReady: false };
        }
        throw new Error('Request failed.');
    }

    const contentType = response.headers.get('content-type') || '';
    let data = {};
    let text = '';
    if (contentType.includes('application/json')) {
        data = await response.json().catch(() => ({}));
    } else {
        text = await response.text().catch(() => '');
    }

    if (!response.ok) {
        const message = data.error || text || 'Request failed.';
        if (String(path || '').startsWith('/api/') && isRecoverableApiError(message) && response.status >= 500) {
            apiConfig = { ...apiConfig, backendReady: false };
        }
        throw new Error(message);
    }

    if (!contentType.includes('application/json')) {
        return text;
    }
    return data;
}

// LIVE BACKEND READINESS SETUP
async function loadApiConfig() {
    try {
        const data = await apiFetch('/api/config');
        apiConfig = {
            backendReady: true,
            razorpayKeyId: data.razorpayKeyId || '',
            adminEnabled: Boolean(data.adminEnabled),
            adminEmail: String(data.adminEmail || '').trim().toLowerCase(),
            otpDelivery: data.otpDelivery || 'preview',
            paymentEnabled: Boolean(data.paymentEnabled),
            paymentReason: String(data.paymentReason || ''),
            health: data.health || null
        };
        currentUser = applyAdminAccess(currentUser);
        persistUser();
    } catch (error) {
        apiConfig = {
            backendReady: false,
            razorpayKeyId: '',
            adminEnabled: false,
            adminEmail: '',
            otpDelivery: 'preview',
            paymentEnabled: false,
            paymentReason: '',
            health: null
        };
    }
}

function renderBackendStatus() {
    const target = document.getElementById('backendStatus');
    if (!target) return;
    if (!apiConfig.backendReady) {
        target.innerHTML = '<strong>Local Mode Active</strong><span>Live backend is unavailable, so the site is using browser fallback for account, orders, and admin tools.</span>';
        target.className = 'backend-status warning';
        return;
    }
    const health = apiConfig.health || {};
    const issues = [];
    if (!health.authConfigured) issues.push('Auth secret missing');
    if (!health.adminConfigured) issues.push('Admin email missing');
    if (!health.razorpayConfigured) issues.push('Razorpay not configured');
    if (issues.length) {
        target.innerHTML = `<strong>Backend Limited</strong><span>${issues.join(' • ')}</span>`;
        target.className = 'backend-status warning';
        return;
    }
    target.innerHTML = `<strong>Backend Live</strong><span>Auth, admin, storage, and payment APIs are available.</span>`;
    target.className = 'backend-status healthy';
}

function downloadJsonFile(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function buildAdminBackupSnapshot() {
    return {
        exportedAt: new Date().toISOString(),
        version: 1,
        config: {
            currency: selectedCurrency,
            adminEmail: apiConfig.adminEmail || FALLBACK_ADMIN_EMAIL
        },
        users: getLocalUsers(),
        orders: getLocalOrders(),
        subscribers: getLocalNewsletterSubscribers(),
        sellerApplications: getSellerApplications(),
        sellerProducts: getSellerProducts(),
        viewSignals: getViewSignals(),
        abandonedCarts: getAbandonedCarts(),
        stockAlerts: getStockAlerts(),
        reviews: getStoredReviews(),
        traffic: getLocalTrafficStats()
    };
}

function exportAdminBackup() {
    if (!currentUser?.isAdmin) {
        showToast('Admin access is required.');
        return;
    }
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadJsonFile(`ruh-imperium-backup-${stamp}.json`, buildAdminBackupSnapshot());
    showToast('Admin backup exported.');
}

function triggerBackupImport() {
    if (!currentUser?.isAdmin) {
        showToast('Admin access is required.');
        return;
    }
    const input = document.getElementById('backupImportInput');
    if (input) input.click();
}

function restoreAdminBackup(data) {
    saveLocalUsers(Array.isArray(data.users) ? data.users : []);
    saveLocalOrders(Array.isArray(data.orders) ? data.orders : []);
    saveLocalNewsletterSubscribers(Array.isArray(data.subscribers) ? data.subscribers : []);
    saveSellerApplications(Array.isArray(data.sellerApplications) ? data.sellerApplications : []);
    saveSellerProducts(Array.isArray(data.sellerProducts) ? data.sellerProducts : []);
    saveViewSignals(Array.isArray(data.viewSignals) ? data.viewSignals : []);
    saveAbandonedCarts(Array.isArray(data.abandonedCarts) ? data.abandonedCarts : []);
    saveStockAlerts(Array.isArray(data.stockAlerts) ? data.stockAlerts : []);
    saveStoredReviews(Array.isArray(data.reviews) ? data.reviews : []);
    saveLocalTrafficStats(data.traffic || { totalVisits: 0, lastVisitedAt: '' });
    syncMarketplaceProducts();
}

function handleBackupImport(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function onLoad() {
        try {
            const parsed = JSON.parse(String(reader.result || '{}'));
            restoreAdminBackup(parsed);
            await loadAdminOrders();
            await loadMyOrders();
            renderCustomerReviews();
            renderHomeSections();
            renderShopGrid();
            showToast('Backup restored successfully.');
        } catch (error) {
            showToast('Backup file could not be restored.');
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}

function renderAdminSetupReadiness() {
    const target = document.getElementById('adminSetupGrid');
    if (!target) return;
    const health = apiConfig.health || {};
    const cards = [
        {
            title: 'Storage',
            ok: apiConfig.backendReady && (health.hostedDatabaseConfigured || health.mongodbConfigured || health.storage === 'mongodb' || health.storage === 'supabase'),
            summary: apiConfig.backendReady ? `Mode: ${health.storage || 'local'}${health.hostedDatabaseConfigured ? ' · Hosted database ready' : ' · Local fallback active'}` : 'Running in browser fallback mode right now.'
        },
        {
            title: 'Payments',
            ok: Boolean(apiConfig.backendReady && health.razorpayConfigured),
            summary: health.razorpayConfigured ? 'Razorpay keys detected for online payments.' : 'Add Razorpay env vars on Railway/Render before going live.'
        },
        {
            title: 'reCAPTCHA',
            ok: Boolean(apiConfig.backendReady && health.recaptchaConfigured),
            summary: health.recaptchaConfigured ? 'Form protection keys are configured.' : 'Site key and secret are still needed to fully lock forms.'
        },
        {
            title: 'Email Delivery',
            ok: Boolean(apiConfig.backendReady && health.emailConfigured),
            summary: health.emailConfigured ? 'SMTP/provider settings are available for notifications.' : 'SMTP/provider creds are still needed for auto mailers.'
        },
        {
            title: 'Analytics',
            ok: Boolean(health.analyticsConfigured),
            summary: health.analyticsConfigured ? 'Google Analytics ID is connected.' : 'Google Analytics property ID still needs to be added.'
        },
        {
            title: 'Search Console',
            ok: Boolean(health.searchConsoleConfigured),
            summary: health.searchConsoleConfigured ? 'Verification token is present in site config.' : 'Search Console verification token is still pending.'
        }
    ];
    target.innerHTML = cards.map(card => `
        <div class="setup-card ${card.ok ? 'ok' : 'warn'}">
            <div class="setup-state">${card.ok ? 'Ready' : 'Pending'}</div>
            <strong>${card.title}</strong>
            <span>${card.summary}</span>
        </div>
    `).join('');
}

function getPaymentReadiness() {
    if (!currentUser || !sessionToken) {
        return { ready: false, message: 'Please sign in before online payment.' };
    }
    if (typeof Razorpay === 'undefined') {
        return { ready: false, message: 'Razorpay checkout script did not load. Refresh once and try again.' };
    }
    if (!apiConfig.backendReady) {
        return { ready: false, message: 'Online payment is unavailable because the live backend is not connected on this deployment.' };
    }
    if (!apiConfig.paymentEnabled) {
        return { ready: false, message: apiConfig.paymentReason || 'Online payment is not configured on the server yet.' };
    }
    if (!apiConfig.razorpayKeyId) {
        return { ready: false, message: 'Razorpay key ID is missing on the server.' };
    }
    return { ready: true, message: 'Online payment is ready.' };
}

function updatePaymentOptionsUI() {
    const razorpayBtn = document.getElementById('payRazorpayBtn');
    const codBtn = document.getElementById('payCodBtn');
    const partialCodBtn = document.getElementById('payPartialCodBtn');
    const note = document.getElementById('paymentStatusNote');
    if (!razorpayBtn || !codBtn || !partialCodBtn) return;

    const readiness = getPaymentReadiness();
    const razorpayAvailable = readiness.ready;

    razorpayBtn.disabled = !razorpayAvailable;
    razorpayBtn.classList.toggle('disabled', !razorpayAvailable);
    razorpayBtn.setAttribute('aria-disabled', String(!razorpayAvailable));

    if (!razorpayAvailable && (selectedPayment === 'Razorpay' || selectedPayment === 'Partial COD')) {
        selectedPayment = 'COD';
    }

    razorpayBtn.classList.toggle('active', selectedPayment === 'Razorpay' && razorpayAvailable);
    codBtn.classList.toggle('active', selectedPayment === 'COD' || !razorpayAvailable);
    partialCodBtn.disabled = !razorpayAvailable;
    partialCodBtn.classList.toggle('disabled', !razorpayAvailable);
    partialCodBtn.classList.toggle('active', selectedPayment === 'Partial COD' && razorpayAvailable);

    if (note) {
        note.textContent = razorpayAvailable
            ? `Online payment is live. Razorpay and ${PARTIAL_COD_DEPOSIT_PERCENT}% Partial COD are available right now.`
            : readiness.message;
        note.className = `payment-status-note ${razorpayAvailable ? 'success' : 'warning'}`;
    }
}

async function refreshPaymentReadiness() {
    await loadApiConfig();
    updateAccountUI();
    updatePaymentOptionsUI();
}

function showToast(msg) {
    const t = document.getElementById('toast');
    const normalizedMsg = String(msg || '').toLowerCase().includes('backend before signing in')
        ? 'Sign in is available on this site. If it still fails, refresh once and try again.'
        : msg;
    t.textContent = normalizedMsg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
}

function buildOtpRequestToast(data, fallbackMessage, label) {
    if (!apiConfig.backendReady) {
        return data.previewOtp ? `${label} sent. Demo OTP: ${data.previewOtp}` : fallbackMessage;
    }
    if (data.delivery === 'sms') {
        return data.message || fallbackMessage;
    }
    if (data.previewOtp) {
        return `${data.message || fallbackMessage} Demo OTP: ${data.previewOtp}`;
    }
    return data.message || fallbackMessage;
}

function resetCouponState() {
    appliedCoupon = null;
    persistState();
    updateCouponUI();
    updateOrderSummary();
}

function showHome() {
    document.getElementById('home-page').style.display = 'block';
    document.getElementById('shop-page').classList.remove('active');
    window.scrollTo(0, 0);
    initReveals();
}

function goSection(id) {
    showHome();
    setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
            return;
        }
        if (id === 'gifting') {
            filterShop('Gifting');
            return;
        }
        if (id === 'wellness') {
            filterShop('Daily');
        }
    }, 100);
}

function filterShop(cat) {
    currentFilter = cat;
    document.getElementById('home-page').style.display = 'none';
    document.getElementById('shop-page').classList.add('active');
    window.scrollTo(0, 0);
    document.getElementById('shopTitle').textContent = cat === 'all' ? 'All Products' : cat;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    renderShopGrid();
}

function shopFilter(cat, btn) {
    currentFilter = cat;
    document.querySelectorAll('.filter-btn').forEach(item => item.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.getElementById('shopTitle').textContent = cat === 'all' ? 'All Products' : cat;
    renderShopGrid();
}

function sortProducts(val) {
    sortMode = val;
    renderShopGrid();
}

function filterByPrice(val) {
    maxPrice = parseInt(val, 10);
    document.getElementById('priceVal').textContent = '₹' + val;
    renderShopGrid();
}

function getFilteredProducts() {
    const filtered = products.filter(product => {
        if (currentFilter === 'all') return true;
        return (
            product.cat.toLowerCase().includes(currentFilter.toLowerCase()) ||
            product.notes.toLowerCase().includes(currentFilter.toLowerCase()) ||
            product.tags.some(tag => tag.toLowerCase().includes(currentFilter.toLowerCase()))
        );
    }).filter(product => product.price <= maxPrice);

    if (sortMode === 'price-asc') filtered.sort((a, b) => a.price - b.price);
    if (sortMode === 'price-desc') filtered.sort((a, b) => b.price - a.price);
    if (sortMode === 'rating') filtered.sort((a, b) => b.stars - a.stars);
    if (sortMode === 'newest') filtered.sort((a, b) => (b.badge === 'NEW' ? 1 : 0) - (a.badge === 'NEW' ? 1 : 0));
    return filtered;
}

function starStr(stars) {
    const full = Math.floor(stars);
    const half = stars % 1 >= 0.5;
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - (half ? 1 : 0));
}

function productCardHTML(product) {
    const inWish = wishlist.includes(product.id);
    return `
    <div class="product-card" onclick="openProductModal(${product.id})">
      ${product.badge ? `<span class="product-badge ${product.badge === 'NEW' ? 'new' : ''}">${product.badge}</span>` : ''}
      <div class="product-img-wrap">
        <img src="${product.img}" alt="${product.name}" onerror="this.style.display='none';this.parentElement.style.background='var(--dark-3)'">
        <button class="wishlist-btn ${inWish ? 'active' : ''}" onclick="toggleWish(event,${product.id})">♥</button>
      </div>
      <div class="product-info">
        <p class="product-desc">${product.cat}</p>
        <h3 class="product-name">${product.name}</h3>
        <div class="product-stars">${starStr(product.stars)} <span>(${product.reviews} reviews)</span></div>
        <div class="product-price-row">
          <div>
            <span class="product-price">${formatCurrency(product.price)}</span>
            ${product.oldPrice ? `<span class="product-price-old">${formatCurrency(product.oldPrice)}</span>` : ''}
          </div>
          <button class="add-btn" onclick="quickAdd(event,${product.id})">Add to Cart</button>
        </div>
      </div>
    </div>`;
}

function renderShopGrid() {
    const filtered = getFilteredProducts();
    const grid = document.getElementById('shopGrid');
    document.getElementById('shopCount').textContent = `${filtered.length} products found`;
    grid.innerHTML = filtered.length === 0
        ? `<div style="grid-column:1/-1;text-align:center;padding:60px;font-family:'Cormorant Garamond',serif;font-size:20px;color:var(--text-light);font-style:italic;">No products found. Try adjusting filters.</div>`
        : filtered.map(product => productCardHTML(product)).join('');
}

function renderHomeSections() {
    const bestsellers = products.filter(product => product.bestseller).slice(0, 4);
    document.getElementById('bestsellerGrid').innerHTML = bestsellers.map(product => productCardHTML(product)).join('');
    const newArrivals = products.filter(product => product.cat === 'Next Gen Fragrances').slice(0, 4);
    document.getElementById('newArrivalsGrid').innerHTML = newArrivals.map(product => productCardHTML(product)).join('');
    const wellnessPicks = products
        .filter(product => product.tags.includes('Daily') || product.notes === 'Fresh' || product.notes === 'Woody')
        .slice(0, 4);
    document.getElementById('wellnessGrid').innerHTML = wellnessPicks.map(product => productCardHTML(product)).join('');
    const giftingPicks = products
        .filter(product => product.tags.includes('Gifting') || product.cat === 'Discovery Set')
        .slice(0, 4);
    document.getElementById('giftingGrid').innerHTML = giftingPicks.map(product => productCardHTML(product)).join('');
    renderRecentlyViewed();
}

function renderRecentlyViewed() {
    const grid = document.getElementById('recentlyViewedGrid');
    if (!grid) return;
    const viewedProducts = recentlyViewed
        .map(id => products.find(product => product.id === id))
        .filter(Boolean)
        .slice(0, 4);
    grid.innerHTML = viewedProducts.length
        ? viewedProducts.map(product => productCardHTML(product)).join('')
        : '<div class="recently-viewed-empty" style="grid-column:1/-1;">Your recently opened fragrances will appear here.</div>';
}

function rememberRecentlyViewed(productId) {
    recentlyViewed = [productId, ...recentlyViewed.filter(id => id !== productId)].slice(0, 8);
    persistState();
    renderRecentlyViewed();
}

function trackViewedProduct(product) {
    if (!product) return;
    const signals = getViewSignals().filter(entry => !(entry.email === (currentUser?.email || '') && entry.productId === product.id));
    signals.unshift({
        id: `view-${Date.now()}`,
        productId: product.id,
        productName: product.name,
        email: currentUser?.email || '',
        phone: currentUser?.phone || '',
        viewedAt: new Date().toISOString(),
        purchased: false
    });
    saveViewSignals(signals.slice(0, 100));
}

function trackAbandonedCart() {
    if (!cart.length) return;
    const items = getAbandonedCarts().filter(entry => entry.email !== (currentUser?.email || ''));
    items.unshift({
        id: `cart-${Date.now()}`,
        email: currentUser?.email || '',
        phone: currentUser?.phone || '',
        customer: currentUser?.name || 'Guest',
        items: cart.map(item => `${item.name} (${item.size}) x ${item.qty}`),
        total: getOrderPricing().total,
        createdAt: new Date().toISOString()
    });
    saveAbandonedCarts(items.slice(0, 100));
}

function getRecommendedProducts(product) {
    if (!product) return [];
    return products
        .filter(item => item.id !== product.id)
        .map(item => {
            let score = 0;
            if (item.cat === product.cat) score += 3;
            if (item.notes === product.notes) score += 2;
            score += item.tags.filter(tag => product.tags.includes(tag)).length;
            return { item, score };
        })
        .sort((a, b) => b.score - a.score || b.item.stars - a.item.stars)
        .slice(0, 4)
        .map(entry => entry.item);
}

async function shareCurrentProduct(product, size) {
    if (!product) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}#product-${product.id}`;
    const shareText = `${product.name}${size ? ` (${size})` : ''} · ₹${product.price.toLocaleString()} · Ruh Imperium`;
    if (navigator.share) {
        try {
            await navigator.share({
                title: product.name,
                text: shareText,
                url: shareUrl
            });
            return;
        } catch (error) {
            if (error.name === 'AbortError') return;
        }
    }
    try {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        showToast('Product link copied.');
    } catch (error) {
        showToast('Unable to share right now.');
    }
}

function toggleWish(event, id) {
    event.stopPropagation();
    if (wishlist.includes(id)) {
        wishlist = wishlist.filter(item => item !== id);
        showToast('Removed from wishlist');
    } else {
        wishlist.push(id);
        showToast('Added to wishlist ❤️');
    }
    persistState();
    updateWishBadge();
    renderHomeSections();
    if (document.getElementById('shop-page').classList.contains('active')) renderShopGrid();
}

function updateWishBadge() {
    const badge = document.getElementById('wishCount');
    if (wishlist.length > 0) {
        badge.textContent = wishlist.length;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

function showWishlist() {
    if (wishlist.length === 0) {
        showToast('Your wishlist is empty');
        return;
    }
    document.getElementById('home-page').style.display = 'none';
    document.getElementById('shop-page').classList.add('active');
    document.getElementById('shopTitle').textContent = 'My Wishlist ❤️';
    window.scrollTo(0, 0);
    const wishProducts = products.filter(product => wishlist.includes(product.id));
    document.getElementById('shopCount').textContent = `${wishProducts.length} items`;
    document.getElementById('shopGrid').innerHTML = wishProducts.map(product => productCardHTML(product)).join('');
}

function quickAdd(event, id) {
    event.stopPropagation();
    const product = products.find(item => item.id === id);
    addToCart(product, product.sizes[0]);
}

function addToCart(product, size) {
    const customText = (document.getElementById('customTextInput')?.value || '').trim();
    const customLogo = (document.getElementById('customLogoInput')?.value || '').trim();
    const existing = cart.find(item => item.id === product.id && item.size === size && item.customText === customText && item.customLogo === customLogo);
    if (existing) existing.qty++;
    else cart.push({ id: product.id, name: product.name, img: product.img, price: product.price, size, qty: 1, customText, customLogo });
    resetCouponState();
    persistState();
    trackAbandonedCart();
    updateCartBadge();
    showToast(`✓ ${product.name} added to cart`);
    renderCartItems();
}

function updateCartBadge() {
    document.getElementById('cartBadge').textContent = cart.reduce((sum, item) => sum + item.qty, 0);
}

function openCart() {
    document.getElementById('cartDrawer').classList.add('open');
    document.getElementById('cartBackdrop').classList.add('open');
}

function closeCart() {
    document.getElementById('cartDrawer').classList.remove('open');
    document.getElementById('cartBackdrop').classList.remove('open');
}

function renderCartItems() {
    const itemsEl = document.getElementById('cartItems');
    const footer = document.getElementById('cartFooter');
    const meta = document.getElementById('cartMeta');
    if (cart.length === 0) {
        itemsEl.innerHTML = '<div class="cart-empty"><span>🧴</span><p>Your cart is beautifully empty</p></div>';
        footer.style.display = 'none';
        return;
    }
    footer.style.display = 'block';
    meta.innerHTML = currentUser
        ? `Signed in as <strong>${currentUser.name}</strong>. Coupons and checkout details are ready to go.`
        : 'Sign in to save your profile and use coupons at checkout.';
    itemsEl.innerHTML = cart.map((item, index) => `
    <div class="cart-item">
      <img class="cart-item-img" src="${item.img}" alt="${item.name}" onerror="this.style.display='none'">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">${formatCurrency(item.price * item.qty)} · ${item.size}</div>
        ${item.customText ? `<div class="cart-item-note">Custom: ${item.customText}</div>` : ''}
        ${item.customLogo ? `<div class="cart-item-note">Logo: ${item.customLogo}</div>` : ''}
        <div class="cart-qty-row">
          <button class="qty-btn" onclick="changeQty(${index},-1)">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty(${index},1)">+</button>
        </div>
      </div>
      <button class="cart-item-del" onclick="removeFromCart(${index})">🗑</button>
    </div>`).join('');
    document.getElementById('cartTotal').textContent = formatCurrency(getOrderPricing().total);
}

function changeQty(index, delta) {
    cart[index].qty += delta;
    if (cart[index].qty <= 0) cart.splice(index, 1);
    resetCouponState();
    persistState();
    if (cart.length) trackAbandonedCart();
    updateCartBadge();
    renderCartItems();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    resetCouponState();
    persistState();
    if (cart.length) trackAbandonedCart();
    updateCartBadge();
    renderCartItems();
}

function getCartTotal() {
    return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function getCheckoutStatePin() {
    return {
        state: document.getElementById('cState')?.value || ORIGIN_STATE,
        pin: document.getElementById('cPin')?.value?.trim() || ''
    };
}

function calculateDeliveryCharge(state, pin, subtotal) {
    const normalizedState = String(state || '').trim();
    const normalizedPin = String(pin || '').trim();
    let extraCharge = 0;
    if (REMOTE_STATES.has(normalizedState)) extraCharge += 99;
    if (/^[78]/.test(normalizedPin)) extraCharge += 40;
    if (subtotal >= 2499) extraCharge = Math.max(extraCharge - 40, 0);
    return extraCharge;
}

function getCartTaxProfile(subtotal, discount) {
    return cart.map(item => {
        const product = products.find(entry => entry.id === item.id) || {};
        const lineTotal = Number(item.price || 0) * Number(item.qty || 0);
        const lineDiscount = subtotal ? Math.round((lineTotal / subtotal) * discount) : 0;
        const taxableLine = Math.max(lineTotal - lineDiscount, 0);
        const gstRate = Number(product.gstRate || CATEGORY_GST_RATES[product.cat] || 18);
        return {
            taxableLine,
            gstRate,
            gstAmount: Math.round(taxableLine * (gstRate / 100))
        };
    });
}

function getDiscountAmount() {
    return appliedCoupon ? appliedCoupon.discountAmount || 0 : 0;
}

function getOrderPricing() {
    const subtotal = getCartTotal();
    const discount = getDiscountAmount();
    const { state, pin } = getCheckoutStatePin();
    const delivery = calculateDeliveryCharge(state, pin, Math.max(subtotal - discount, 0));
    const gstTotal = getCartTaxProfile(subtotal, discount).reduce((sum, item) => sum + item.gstAmount, 0);
    const intrastate = String(state || '').trim().toLowerCase() === ORIGIN_STATE.toLowerCase();
    const gstBreakdown = intrastate
        ? { cgst: Math.round(gstTotal / 2), sgst: gstTotal - Math.round(gstTotal / 2), igst: 0 }
        : { cgst: 0, sgst: 0, igst: gstTotal };
    return {
        subtotal,
        discount,
        delivery,
        gstTotal,
        gstBreakdown,
        total: Math.max(subtotal - discount, 0) + delivery + gstTotal
    };
}

function updateCouponUI() {
    const chip = document.getElementById('couponChip');
    const chipText = document.getElementById('couponChipText');
    const couponInput = document.getElementById('couponCode');
    if (!chip || !chipText || !couponInput) return;
    if (appliedCoupon) {
        chip.classList.add('show');
        chipText.textContent = `${appliedCoupon.code} applied · You save ₹${appliedCoupon.discountAmount.toLocaleString()}`;
        couponInput.value = appliedCoupon.code;
    } else {
        chip.classList.remove('show');
        couponInput.value = '';
    }
}

// COUPON VALIDATION SETUP
async function applyCoupon() {
    const code = document.getElementById('couponCode').value.trim().toUpperCase();
    if (!code) {
        showToast('Enter a coupon code first.');
        return;
    }
    const customer = {
        state: document.getElementById('cState')?.value?.trim() || currentUser?.state || '',
        pin: document.getElementById('cPin')?.value?.trim() || ''
    };
    const fallbackApplyCoupon = (successMessage) => {
        appliedCoupon = getLocalCoupon(code, getCartTotal());
        persistState();
        updateCouponUI();
        renderCartItems();
        updateOrderSummary();
        showToast(successMessage);
    };
    if (!apiConfig.backendReady) {
        try {
            fallbackApplyCoupon(`${code} applied successfully.`);
        } catch (error) {
            showToast(error.message);
        }
        return;
    }
    try {
        const data = await apiFetch('/api/coupons/validate', {
            method: 'POST',
            body: JSON.stringify({ code, cart, customer })
        });
        appliedCoupon = data.coupon;
        persistState();
        updateCouponUI();
        renderCartItems();
        updateOrderSummary();
        showToast(`${code} applied successfully.`);
    } catch (error) {
        try {
            fallbackApplyCoupon(`${code} applied successfully in fallback mode.`);
            return;
        } catch (localError) {
            if (!isRecoverableApiError(error.message)) {
                showToast(error.message);
                return;
            }
            showToast(localError.message);
            return;
        }
    }
}

function removeCoupon() {
    appliedCoupon = null;
    persistState();
    updateCouponUI();
    renderCartItems();
    updateOrderSummary();
    showToast('Coupon removed.');
}

function whatsappOrder() {
    if (cart.length === 0) {
        showToast('Cart is empty!');
        return;
    }
    const pricing = getOrderPricing();
    let msg = '🌹 *Ruh Imperium Order* 🌹\n\nI would like to order:\n\n';
    cart.forEach(item => {
        msg += `• ${item.name} (${item.size}) × ${item.qty} = ₹${(item.price * item.qty).toLocaleString()}\n`;
    });
    if (appliedCoupon) msg += `\nCoupon: ${appliedCoupon.code} (-₹${pricing.discount.toLocaleString()})\n`;
    msg += `\n*Total: ₹${pricing.total.toLocaleString()}*\n\nPlease confirm my order. Thank you!`;
    window.open('https://wa.me/919785854770?text=' + encodeURIComponent(msg), '_blank');
}

function openProductModal(id) {
    const product = products.find(item => item.id === id);
    if (!product) return;
    currentProduct = product;
    rememberRecentlyViewed(product.id);
    trackViewedProduct(product);

    document.getElementById('modalCat').textContent = product.cat;
    document.getElementById('modalName').textContent = product.name;
    document.getElementById('modalStars').innerHTML = starStr(product.stars) + ` <span>(${product.reviews} reviews)</span>`;
    document.getElementById('modalPrice').textContent = formatCurrency(product.price);
    document.getElementById('modalOldPrice').textContent = product.oldPrice ? formatCurrency(product.oldPrice) : '';
    document.getElementById('modalDesc').textContent = product.desc;

    const imgWrap = document.getElementById('modalImg');
    imgWrap.innerHTML = `<img src="${product.img}" alt="${product.name}" onerror="this.style.display='none';this.parentElement.style.background='var(--dark-3)'">`;
    if (product.badge) {
        const badge = document.createElement('span');
        badge.className = 'modal-badge' + (product.badge === 'NEW' ? ' new' : '');
        badge.textContent = product.badge;
        imgWrap.appendChild(badge);
    }

    const selectedSize = product.sizes[0];
    document.getElementById('sizeOpts').innerHTML = product.sizes.map((size, index) =>
        `<button class="size-opt ${index === 0 ? 'active' : ''}" onclick="selectSize(this,'${size}')">${size}</button>`
    ).join('');
    document.getElementById('recommendationList').innerHTML = getRecommendedProducts(product)
        .map(item => `<button class="recommendation-pill" type="button" onclick="openProductModal(${item.id})">${item.name}</button>`)
        .join('');

    document.getElementById('modalAddBtn').onclick = () => {
        addToCart(product, selectedSize);
        closeProductModal();
        openCart();
    };

    document.getElementById('modalWaBtn').onclick = () => {
        const msg = `Hello! I am interested in *${product.name}* (${selectedSize}) at ${formatCurrency(product.price)}. Please help me place an order.`;
        window.open('https://wa.me/919785854770?text=' + encodeURIComponent(msg), '_blank');
    };
    document.getElementById('modalShareBtn').onclick = () => shareCurrentProduct(product, selectedSize);

    document.getElementById('productModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function selectSize(btn, size) {
    document.querySelectorAll('.size-opt').forEach(item => item.classList.remove('active'));
    btn.classList.add('active');
    if (currentProduct) {
        document.getElementById('modalAddBtn').onclick = () => {
            addToCart(currentProduct, size);
            closeProductModal();
            openCart();
        };
        document.getElementById('modalWaBtn').onclick = () => {
            const msg = `Hello! I am interested in *${currentProduct.name}* (${size}) at ${formatCurrency(currentProduct.price)}. Please help me place an order.`;
            window.open('https://wa.me/919785854770?text=' + encodeURIComponent(msg), '_blank');
        };
        document.getElementById('modalShareBtn').onclick = () => shareCurrentProduct(currentProduct, size);
    }
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('open');
    document.body.style.overflow = '';
}

function closeModal(event) {
    if (event.target === document.getElementById('productModal')) closeProductModal();
}

function openCheckout() {
    if (cart.length === 0) {
        showToast('Cart is empty!');
        return;
    }
    if (!currentUser || !sessionToken) {
        showToast('Please sign in before checkout.');
        openAuthModal();
        return;
    }
    closeCart();
    prefillCheckout();
    updateCouponUI();
    updateOrderSummary();
    document.getElementById('checkoutModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeCheckout() {
    document.getElementById('checkoutModal').classList.remove('open');
    document.body.style.overflow = '';
}

function updateOrderSummary() {
    const summary = document.getElementById('orderSummary');
    if (!summary) return;
    const pricing = getOrderPricing();
    const couponLine = appliedCoupon
        ? `<div class="order-line"><span>Coupon (${appliedCoupon.code})</span><span>-₹${pricing.discount.toLocaleString()}</span></div>`
        : '';
    const shippingLine = pricing.delivery
        ? `<div class="order-line"><span>Location Delivery Charge</span><span>₹${pricing.delivery.toLocaleString()}</span></div>`
        : `<div class="order-line"><span>Delivery</span><span style="color:var(--green)">FREE</span></div>`;
    const gstLines = pricing.gstBreakdown?.igst
        ? `<div class="order-line"><span>IGST</span><span>₹${pricing.gstBreakdown.igst.toLocaleString()}</span></div>`
        : `<div class="order-line"><span>CGST</span><span>₹${Number(pricing.gstBreakdown?.cgst || 0).toLocaleString()}</span></div>
        <div class="order-line"><span>SGST</span><span>₹${Number(pricing.gstBreakdown?.sgst || 0).toLocaleString()}</span></div>`;
    const partialCodLine = selectedPayment === 'Partial COD'
        ? (() => {
            const amounts = getPartialCodAmounts(pricing.total);
            return `<div class="order-line"><span>Pay Now (${PARTIAL_COD_DEPOSIT_PERCENT}%)</span><span>₹${amounts.deposit.toLocaleString()}</span></div>
        <div class="order-line"><span>Pay on Delivery</span><span>₹${amounts.balance.toLocaleString()}</span></div>`;
        })()
        : '';
    summary.innerHTML = '<h3>Order Summary</h3>' +
        cart.map(item =>
            `<div class="order-line"><span>${item.name} (${item.size}) × ${item.qty}</span><span>₹${(item.price * item.qty).toLocaleString()}</span></div>`
        ).join('') +
        `<div class="order-line"><span>Subtotal</span><span>₹${pricing.subtotal.toLocaleString()}</span></div>` +
        couponLine +
        shippingLine +
        gstLines +
        partialCodLine +
        `<div class="order-line"><span>Total</span><span>₹${pricing.total.toLocaleString()}</span></div>`;
}

function updatePinServiceability() {
    const pin = document.getElementById('cPin')?.value?.trim() || '';
    const state = document.getElementById('cState')?.value || ORIGIN_STATE;
    const target = document.getElementById('pinServiceabilityStatus');
    if (!target) return;
    if (!pin) {
        target.textContent = 'Enter PIN code to check delivery availability and extra shipping.';
        return;
    }
    if (!/^\d{6}$/.test(pin)) {
        target.textContent = 'Please enter a valid 6-digit PIN code.';
        return;
    }
    const charge = calculateDeliveryCharge(state, pin, getCartTotal());
    if (/^[1-9]\d{5}$/.test(pin)) {
        target.textContent = charge
            ? `Delivery available. Extra location charge: ${formatCurrency(charge)}.`
            : 'Delivery available at no extra shipping charge.';
    } else {
        target.textContent = 'Delivery may be limited for this PIN code.';
    }
}

function selectPay(btn, type) {
    if (type === 'Razorpay' || type === 'Partial COD') {
        const readiness = getPaymentReadiness();
        if (!readiness.ready) {
            selectedPayment = 'COD';
            updatePaymentOptionsUI();
            showToast(readiness.message);
            return;
        }
    }
    selectedPayment = type;
    updatePaymentOptionsUI();
    updateOrderSummary();
}

function getCheckoutOtpIdentifier(details = getCheckoutDetails()) {
    if (!details) return '';
    return details.phone || details.email || '';
}

function updateCheckoutOtpUI() {
    const placeOrderBtn = document.getElementById('placeOrderBtn');
    if (!placeOrderBtn) return;
    const details = getCheckoutDetails();
    placeOrderBtn.disabled = !details || !getCheckoutOtpIdentifier(details);
}

function resetCheckoutOtpState() {
    clearPendingLocalCheckoutOtp();
    updateCheckoutOtpUI();
}

function handleCheckoutIdentityChange() {
    updateCheckoutOtpUI();
}

function prefillCheckout() {
    if (!currentUser) return;
    document.getElementById('cName').value = currentUser.name || '';
    document.getElementById('cPhone').value = currentUser.phone || '';
    document.getElementById('cEmail').value = currentUser.email || '';
    resetCheckoutOtpState();
    updatePaymentOptionsUI();
}

function getCheckoutDetails() {
    const name = document.getElementById('cName').value.trim();
    const phone = document.getElementById('cPhone').value.trim();
    const email = document.getElementById('cEmail').value.trim();
    const address = document.getElementById('cAddress').value.trim();
    const city = document.getElementById('cCity').value.trim();
    const pin = document.getElementById('cPin').value.trim();
    const state = document.getElementById('cState').value;
    if (!name || !phone || !address || !city || !pin) {
        showToast('Please fill all required fields!');
        return null;
    }
    return { name, phone, email, address, city, pin, state };
}

function buildOrderMessage(details, paymentLabel, paymentId = '') {
    const pricing = getOrderPricing();
    let msg = '🌹 *New Order - Ruh Imperium* 🌹\n\n';
    msg += `*Customer:* ${details.name}\n*Phone:* ${details.phone}\n`;
    if (details.email) msg += `*Email:* ${details.email}\n`;
    msg += `*Address:* ${details.address}, ${details.city}, ${details.state} - ${details.pin}\n`;
    msg += `*Payment:* ${paymentLabel}\n`;
    if (paymentId) msg += `*Payment ID:* ${paymentId}\n`;
    msg += '\n*Order Details:*\n';
    cart.forEach(item => {
        msg += `• ${item.name} (${item.size}) × ${item.qty} = ${formatCurrency(item.price * item.qty)}\n`;
        if (item.customText) msg += `  Custom Text: ${item.customText}\n`;
        if (item.customLogo) msg += `  Logo URL: ${item.customLogo}\n`;
    });
    if (appliedCoupon) msg += `\n*Coupon:* ${appliedCoupon.code} (-₹${pricing.discount.toLocaleString()})\n`;
    if (pricing.delivery) msg += `*Delivery Charge:* ₹${pricing.delivery.toLocaleString()}\n`;
    if (pricing.gstBreakdown?.igst) msg += `*IGST:* ₹${pricing.gstBreakdown.igst.toLocaleString()}\n`;
    else msg += `*CGST:* ₹${Number(pricing.gstBreakdown?.cgst || 0).toLocaleString()} | *SGST:* ₹${Number(pricing.gstBreakdown?.sgst || 0).toLocaleString()}\n`;
    if (paymentLabel === 'Partial COD') {
        const amounts = getPartialCodAmounts(pricing.total);
        msg += `\n*Paid Now:* ₹${amounts.deposit.toLocaleString()}\n*Pay on Delivery:* ₹${amounts.balance.toLocaleString()}\n`;
    }
    msg += `\n*Total: ₹${pricing.total.toLocaleString()}*`;
    return msg;
}

function finalizeOrder(successMessage) {
    if (currentUser?.email) {
        const signals = getViewSignals().map(entry => (
            entry.email === currentUser.email ? { ...entry, purchased: true } : entry
        ));
        saveViewSignals(signals);
        const remainingAbandoned = getAbandonedCarts().filter(entry => entry.email !== currentUser.email);
        saveAbandonedCarts(remainingAbandoned);
    }
    closeCheckout();
    cart = [];
    appliedCoupon = null;
    resetCheckoutOtpState();
    persistState();
    updateCartBadge();
    renderCartItems();
    updateCouponUI();
    updateOrderSummary();
    showToast(successMessage);
    loadMyOrders();
}

function launchWhatsAppOrder(details, paymentLabel, paymentId = '') {
    const msg = buildOrderMessage(details, paymentLabel, paymentId);
    window.open('https://wa.me/919785854770?text=' + encodeURIComponent(msg), '_blank');
}

async function processCodOrder(details) {
    if (!apiConfig.backendReady) {
        saveLocalCodOrder(details);
        return;
    }
    try {
        await apiFetch('/api/orders/cod', {
            method: 'POST',
            body: JSON.stringify({
                cart,
                couponCode: appliedCoupon ? appliedCoupon.code : '',
                customer: details
            })
        }, true);
        launchWhatsAppOrder(details, 'Cash on Delivery');
        finalizeOrder('Order placed successfully with Cash on Delivery.');
    } catch (error) {
        const message = String(error.message || '');
        const shouldFallback = (
            !sessionToken ||
            /request failed/i.test(message) ||
            /failed to fetch/i.test(message) ||
            /internal server error/i.test(message) ||
            /api route not found/i.test(message) ||
            /unexpected token/i.test(message) ||
            /network/i.test(message)
        );
        const shouldBlock = (
            /please sign in again/i.test(message) ||
            /invalid coupon/i.test(message) ||
            /coupon works on orders above/i.test(message) ||
            /one or more cart items are invalid/i.test(message)
        );
        if (shouldFallback && !shouldBlock) {
            saveLocalCodOrder(details);
            showToast('Order saved in fallback mode because the live checkout API is unavailable right now.');
            return;
        }
        showToast(error.message);
    }
}

async function processPartialCodOrder(details) {
    await refreshPaymentReadiness();
    const readiness = getPaymentReadiness();
    if (!readiness.ready) {
        updatePaymentOptionsUI();
        showToast(readiness.message);
        return;
    }
    try {
        const orderData = await apiFetch('/api/payments/razorpay/order', {
            method: 'POST',
            body: JSON.stringify({
                cart,
                couponCode: appliedCoupon ? appliedCoupon.code : '',
                customer: details,
                paymentPlan: 'partial-cod'
            })
        }, true);
        const amounts = getPartialCodAmounts(getOrderPricing().total);
        const options = {
            key: orderData.keyId,
            amount: orderData.amount,
            currency: orderData.currency,
            order_id: orderData.orderId,
            name: 'Ruh Imperium',
            description: `Partial COD deposit for ${details.name}`,
            image: 'gulabattar.png',
            handler: async function handler(response) {
                try {
                    await apiFetch('/api/payments/razorpay/verify', {
                        method: 'POST',
                        body: JSON.stringify({
                            orderId: response.razorpay_order_id,
                            paymentId: response.razorpay_payment_id,
                            signature: response.razorpay_signature
                        })
                    }, true);
                    launchWhatsAppOrder(details, 'Partial COD', response.razorpay_payment_id);
                    finalizeOrder(`Partial COD booked. ₹${amounts.deposit.toLocaleString()} paid now, ₹${amounts.balance.toLocaleString()} due on delivery.`);
                } catch (error) {
                    showToast(error.message);
                }
            },
            prefill: {
                name: details.name,
                email: details.email,
                contact: details.phone
            },
            notes: {
                address: `${details.address}, ${details.city}, ${details.state} - ${details.pin}`,
                coupon: appliedCoupon ? appliedCoupon.code : 'None',
                paymentPlan: 'partial-cod',
                payNow: String(amounts.deposit),
                payOnDelivery: String(amounts.balance)
            },
            theme: {
                color: '#c9a84c'
            },
            modal: {
                ondismiss() {
                    showToast('Partial COD payment was closed.');
                }
            }
        };
        const razorpay = new Razorpay(options);
        razorpay.open();
    } catch (error) {
        const message = String(error.message || '');
        if (isRecoverableApiError(message)) {
            saveLocalPartialCodOrder(details);
            showToast('Partial COD saved in fallback mode because the live payment API is unavailable.');
            return;
        }
        showToast(message);
    }
}

async function requestCheckoutOtp() {
    showToast('Order OTP verification has been removed.');
}

async function verifyCheckoutOtp(details) {
    return Boolean(details && getCheckoutOtpIdentifier(details));
}

async function processRazorpayOrder(details) {
    await refreshPaymentReadiness();
    const readiness = getPaymentReadiness();
    if (!readiness.ready) {
        updatePaymentOptionsUI();
        showToast(readiness.message);
        return;
    }
    try {
        const orderData = await apiFetch('/api/payments/razorpay/order', {
            method: 'POST',
            body: JSON.stringify({
                cart,
                couponCode: appliedCoupon ? appliedCoupon.code : '',
                customer: details
            })
        }, true);

        const options = {
            key: orderData.keyId,
            amount: orderData.amount,
            currency: orderData.currency,
            order_id: orderData.orderId,
            name: 'Ruh Imperium',
            description: `Order for ${details.name}`,
            image: 'gulabattar.png',
            handler: async function handler(response) {
                try {
                    await apiFetch('/api/payments/razorpay/verify', {
                        method: 'POST',
                        body: JSON.stringify({
                            orderId: response.razorpay_order_id,
                            paymentId: response.razorpay_payment_id,
                            signature: response.razorpay_signature
                        })
                    }, true);
                    launchWhatsAppOrder(details, 'Razorpay', response.razorpay_payment_id);
                    finalizeOrder('Payment received successfully via Razorpay.');
                } catch (error) {
                    showToast(error.message);
                }
            },
            prefill: {
                name: details.name,
                email: details.email,
                contact: details.phone
            },
            notes: {
                address: `${details.address}, ${details.city}, ${details.state} - ${details.pin}`,
                coupon: appliedCoupon ? appliedCoupon.code : 'None'
            },
            theme: {
                color: '#c9a84c'
            },
            modal: {
                ondismiss() {
                    showToast('Razorpay checkout was closed.');
                }
            }
        };
        const razorpay = new Razorpay(options);
        razorpay.open();
    } catch (error) {
        const message = String(error.message || '');
        await refreshPaymentReadiness();
        if (/please sign in again/i.test(message)) {
            showToast('Your session expired. Please sign in again before online payment.');
            return;
        }
        if (/razorpay keys are missing/i.test(message) || /auth secret is missing/i.test(message)) {
            updatePaymentOptionsUI();
            showToast(message);
            return;
        }
        if (isRecoverableApiError(message)) {
            updatePaymentOptionsUI();
            showToast('Online payment is unavailable right now on this deployment. Please use Cash on Delivery.');
            return;
        }
        showToast(message);
    }
}

async function placeOrder() {
    const details = getCheckoutDetails();
    if (!details) return;
    currentUser = { ...currentUser, name: details.name, email: details.email, phone: details.phone };
    persistUser();
    updateAccountUI();
    if (selectedPayment === 'COD') {
        await processCodOrder(details);
        return;
    }
    if (selectedPayment === 'Partial COD') {
        await processPartialCodOrder(details);
        return;
    }
    await processRazorpayOrder(details);
}

function formatDate(value) {
    return new Date(value).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
}

function renderCustomerReviews() {
    const list = document.getElementById('customerReviewList');
    const average = document.getElementById('liveReviewAverage');
    const count = document.getElementById('liveReviewCount');
    if (!list || !average || !count) return;
    const reviews = getStoredReviews().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (!reviews.length) {
        average.textContent = '4.8';
        count.textContent = 'Based on 1,000+ reviews';
        list.innerHTML = '';
        return;
    }
    const avgValue = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length;
    average.textContent = avgValue.toFixed(1);
    count.textContent = `Based on ${reviews.length.toLocaleString()} customer reviews`;
    list.innerHTML = reviews.slice(0, 6).map(review => `
        <div class="review-card reveal">
            <div class="review-stars">${starStr(Number(review.rating || 5))}</div>
            <p class="review-text">"${review.comment}"</p>
            <div class="reviewer">
                <div class="reviewer-avatar">${String(review.name || 'R').charAt(0).toUpperCase()}</div>
                <div>
                    <span class="reviewer-name">${review.name}</span>
                    <span class="reviewer-date">${formatDate(review.createdAt)}</span>
                    <span class="reviewer-product">${review.productName || 'Ruh Imperium Product'}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function populateReviewProductOptions() {
    const select = document.getElementById('reviewProduct');
    if (!select) return;
    select.innerHTML = `<option value="">Select product</option>${products.map(product => `<option value="${product.id}">${product.name}</option>`).join('')}`;
}

function submitReview() {
    const name = document.getElementById('reviewName')?.value?.trim();
    const productId = Number(document.getElementById('reviewProduct')?.value || 0);
    const rating = Number(document.getElementById('reviewRating')?.value || 0);
    const comment = document.getElementById('reviewComment')?.value?.trim();
    const product = products.find(item => item.id === productId);
    if (!name || !product || !rating || !comment) {
        showToast('Please complete all review fields.');
        return;
    }
    const reviews = getStoredReviews();
    reviews.unshift({
        id: `review-${Date.now()}`,
        name,
        productId,
        productName: product.name,
        rating,
        comment,
        createdAt: new Date().toISOString()
    });
    saveStoredReviews(reviews);
    document.getElementById('reviewName').value = '';
    document.getElementById('reviewProduct').value = '';
    document.getElementById('reviewRating').value = '5';
    document.getElementById('reviewComment').value = '';
    renderCustomerReviews();
    showToast('Review submitted successfully.');
}

function updateCurrency(newCurrency) {
    selectedCurrency = newCurrency || 'INR';
    persistState();
    renderHomeSections();
    if (document.getElementById('shop-page').classList.contains('active')) renderShopGrid();
    renderCartItems();
    updateOrderSummary();
    if (currentProduct) openProductModal(currentProduct.id);
}

// SELLER APPLICATION SETUP
function submitSellerApplication() {
    if (!currentUser) {
        showToast('Please sign in before applying as a seller.');
        openAuthModal();
        return;
    }
    const businessName = document.getElementById('sellerBusinessName')?.value?.trim();
    const businessCategory = document.getElementById('sellerBusinessCategory')?.value?.trim();
    if (!businessName || !businessCategory) {
        showToast('Please complete seller application details.');
        return;
    }
    const applications = getSellerApplications().filter(item => item.email !== currentUser.email);
    applications.unshift({
        id: `seller-${Date.now()}`,
        name: currentUser.name,
        email: currentUser.email,
        phone: currentUser.phone,
        businessName,
        businessCategory,
        status: 'pending',
        createdAt: new Date().toISOString()
    });
    saveSellerApplications(applications);
    syncCurrentUserProfile({ sellerStatus: 'pending' });
    document.getElementById('sellerBusinessName').value = '';
    document.getElementById('sellerBusinessCategory').value = '';
    renderSellerDashboard();
    showToast('Seller application submitted.');
}

// SELLER PRODUCT SUBMISSION SETUP
function submitSellerProduct() {
    if (!currentUser) {
        showToast('Please sign in before adding seller products.');
        openAuthModal();
        return;
    }
    const productName = document.getElementById('sellerProductName')?.value?.trim();
    const productPrice = Number(document.getElementById('sellerProductPrice')?.value || 0);
    const productCategory = document.getElementById('sellerProductCategory')?.value?.trim();
    const productDescription = document.getElementById('sellerProductDescription')?.value?.trim();
    const productImage = document.getElementById('sellerProductImage')?.value?.trim();
    const myApplication = getSellerApplications().find(item => item.email === currentUser.email);
    if (myApplication?.status !== 'approved') {
        showToast('Seller application approval is required before adding products.');
        return;
    }
    if (!productName || !productPrice || !productCategory) {
        showToast('Please complete seller product details.');
        return;
    }
    const sellerProducts = getSellerProducts();
    sellerProducts.unshift({
        id: `seller-product-${Date.now()}`,
        sellerEmail: currentUser.email,
        sellerName: currentUser.name,
        name: productName,
        price: productPrice,
        category: productCategory,
        description: productDescription,
        image: productImage,
        status: 'pending',
        createdAt: new Date().toISOString()
    });
    saveSellerProducts(sellerProducts);
    document.getElementById('sellerProductName').value = '';
    document.getElementById('sellerProductPrice').value = '';
    document.getElementById('sellerProductCategory').value = '';
    document.getElementById('sellerProductDescription').value = '';
    document.getElementById('sellerProductImage').value = '';
    renderSellerDashboard();
    showToast('Seller product submitted for approval.');
}

// STOCK ALERT SUBSCRIPTION SETUP
function subscribeStockAlert() {
    const email = (currentUser?.email || document.getElementById('stockAlertEmail')?.value || '').trim().toLowerCase();
    const productId = currentProduct?.id || 0;
    if (!email || !productId) {
        showToast('Open a product and enter email to subscribe for stock alerts.');
        return;
    }
    const alerts = getStockAlerts().filter(item => !(item.email === email && item.productId === productId));
    alerts.unshift({
        id: `stock-${Date.now()}`,
        email,
        productId,
        productName: currentProduct.name,
        createdAt: new Date().toISOString()
    });
    saveStockAlerts(alerts);
    const target = document.getElementById('stockAlertEmail');
    if (target) target.value = '';
    showToast('Stock alert subscription saved.');
}

// SELLER DASHBOARD SETUP
function renderSellerDashboard() {
    const wrap = document.getElementById('sellerDashboardArea');
    if (!wrap) return;
    if (!currentUser) {
        wrap.innerHTML = '<p class="auth-help">Sign in to apply as a seller and add products from the front end.</p>';
        return;
    }
    const myApplication = getSellerApplications().find(item => item.email === currentUser.email);
    const myProducts = getSellerProducts().filter(item => item.sellerEmail === currentUser.email).slice(0, 5);
    wrap.innerHTML = `
        <div class="account-card">
            <strong>Seller Dashboard</strong>
            <div class="order-meta-line">Application status: ${titleCase(myApplication?.status || 'not applied')}</div>
            <div class="order-meta-line">Submitted products: ${myProducts.length}</div>
            ${myApplication?.status === 'approved' ? '<div class="order-meta-line">Marketplace access is active. Approved products can be published to the storefront.</div>' : '<div class="order-meta-line">Apply first, then wait for admin approval to unlock catalog submission.</div>'}
        </div>
        <div class="auth-form">
            <div class="form-group"><label>Business Name</label><input type="text" id="sellerBusinessName" placeholder="Your brand / store name"></div>
            <div class="form-group"><label>Business Category</label><input type="text" id="sellerBusinessCategory" placeholder="Perfume, apparel, gifting, etc."></div>
            <button class="secondary-btn" type="button" onclick="submitSellerApplication()">Apply As Seller</button>
            <div class="form-group"><label>Product Name</label><input type="text" id="sellerProductName" placeholder="Seller product name"></div>
            <div class="form-row">
                <div class="form-group"><label>Product Price</label><input type="number" id="sellerProductPrice" placeholder="1999"></div>
                <div class="form-group"><label>Product Category</label><input type="text" id="sellerProductCategory" placeholder="Category"></div>
            </div>
            <div class="form-group"><label>Product Description</label><textarea id="sellerProductDescription" placeholder="Describe your product for the storefront"></textarea></div>
            <div class="form-group"><label>Product Image URL</label><input type="url" id="sellerProductImage" placeholder="https://example.com/image.jpg"></div>
            <button class="secondary-btn" type="button" onclick="submitSellerProduct()">Submit Product</button>
        </div>
        ${myProducts.length ? `<div class="account-card">${myProducts.map(item => `<div class="order-meta-line">${item.name} · ${formatCurrency(item.price)} · ${titleCase(item.status)}</div>`).join('')}</div>` : ''}
    `;
}

function titleCase(value) {
    return String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1);
}

function buildTrackingUrl(courierName, trackingId) {
    const courier = String(courierName || '').trim().toLowerCase();
    const tracking = encodeURIComponent(String(trackingId || '').trim());
    if (!tracking) return '';
    if (courier.includes('delhivery')) return `https://www.delhivery.com/track/package/${tracking}`;
    if (courier.includes('blue dart') || courier.includes('bluedart')) return `https://www.bluedart.com/tracking?tracking=${tracking}`;
    if (courier.includes('india post') || courier.includes('speed post')) return `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?consignment=${tracking}`;
    if (courier.includes('dtdc')) return `https://www.dtdc.in/tracking/tracking_results.asp?strCnno=${tracking}`;
    if (courier.includes('xpressbees')) return `https://www.xpressbees.com/shipment/tracking?trackingNumber=${tracking}`;
    if (courier.includes('ekart')) return `https://ekartlogistics.com/shipmenttrack/${tracking}`;
    if (courier.includes('ecom') || courier.includes('ecom express')) return `https://ecomexpress.in/tracking/?awb_field=${tracking}`;
    return `https://www.google.com/search?q=${encodeURIComponent(`${courierName || 'courier'} tracking ${trackingId}`)}`;
}

function openTrackingLink(courierName, trackingId) {
    const url = buildTrackingUrl(courierName, trackingId);
    if (!url) {
        showToast('Tracking link is not available yet.');
        return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
}

function buildOrderTimeline(order) {
    const steps = ['pending', 'confirmed', 'shipped', 'delivered'];
    const activeStatus = String(order.orderStatus || 'pending').toLowerCase();
    const activeIndex = Math.max(steps.indexOf(activeStatus), 0);
    return `
        <div class="order-timeline">
            ${steps.map((step, index) => {
                const stateClass = index < activeIndex ? 'done' : index === activeIndex ? 'active' : '';
                return `<div class="timeline-step ${stateClass}"><strong>${titleCase(step)}</strong></div>`;
            }).join('')}
        </div>
    `;
}

function openAdminWhatsApp(orderId) {
    const order = adminOrderHistory.find(item => item.id === orderId) || orderHistory.find(item => item.id === orderId);
    if (!order || !order.customerPhone) {
        showToast('Customer phone number is not available.');
        return;
    }
    const items = (order.items || []).map(item => `${item.name} (${item.size}) x ${item.qty}`).join(', ');
    const message = `Hello ${order.customerName || 'Customer'}, regarding your Ruh Imperium order ${order.id}. Items: ${items}.`;
    const phone = String(order.customerPhone).replace(/[^\d]/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
}

function openAdminEmail(orderId) {
    const order = adminOrderHistory.find(item => item.id === orderId) || orderHistory.find(item => item.id === orderId);
    if (!order || !order.customerEmail) {
        showToast('Customer email is not available.');
        return;
    }
    const subject = `Ruh Imperium Order ${order.id}`;
    const body = `Hello ${order.customerName || 'Customer'},%0D%0A%0D%0AThis is regarding your order ${order.id}.%0D%0AOrder status: ${titleCase(order.orderStatus || 'pending')}.`;
    window.location.href = `mailto:${encodeURIComponent(order.customerEmail)}?subject=${encodeURIComponent(subject)}&body=${body}`;
}

async function copyAdminOrderSummary(orderId) {
    const order = adminOrderHistory.find(item => item.id === orderId) || orderHistory.find(item => item.id === orderId);
    if (!order) {
        showToast('Order not found.');
        return;
    }
    const summary = [
        `Order: ${order.id}`,
        `Customer: ${order.customerName || ''}`,
        `Phone: ${order.customerPhone || ''}`,
        `Email: ${order.customerEmail || ''}`,
        `Payment: ${order.paymentMethod} · ${order.paymentStatus}`,
        `Order Status: ${order.orderStatus || 'pending'}`,
        `Total: ₹${Number(order.total || 0).toLocaleString()}`,
        `Items: ${(order.items || []).map(item => `${item.name} (${item.size}) x ${item.qty}`).join(', ')}`
    ].join('\n');
    try {
        await navigator.clipboard.writeText(summary);
        showToast('Order summary copied.');
    } catch (error) {
        showToast('Unable to copy order summary right now.');
    }
}

async function openOrderDocument(orderId, type, event) {
    const trigger = event?.currentTarget || null;
    if (trigger) trigger.classList.add('generating');
    const docWindow = window.open('', '_blank');
    if (!docWindow) {
        if (trigger) trigger.classList.remove('generating');
        showToast('Please allow pop-ups to open the document.');
        return;
    }
    docWindow.document.write('<p style="font-family:Arial,sans-serif;padding:24px">Loading document...</p>');
    if (!apiConfig.backendReady) {
        const allOrders = [...orderHistory, ...adminOrderHistory];
        const order = allOrders.find(item => item.id === orderId);
        if (!order) {
            docWindow.close();
            if (trigger) trigger.classList.remove('generating');
            showToast('Order document not found.');
            return;
        }
        docWindow.document.open();
        docWindow.document.write(buildOrderDocumentHtmlClient(order, type));
        docWindow.document.close();
        if (trigger) trigger.classList.remove('generating');
        return;
    }
    if (!sessionToken) {
        docWindow.close();
        if (trigger) trigger.classList.remove('generating');
        showToast('Please sign in again to open documents.');
        return;
    }
    try {
        const response = await fetch(`/api/orders/${orderId}/document?type=${encodeURIComponent(type)}`, {
            headers: {
                Authorization: `Bearer ${sessionToken}`
            }
        });
        const html = await response.text();
        if (!response.ok) {
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                const data = JSON.parse(html);
                throw new Error(data.error || 'Unable to open document.');
            }
            throw new Error('Unable to open document.');
        }
        docWindow.document.open();
        docWindow.document.write(html);
        docWindow.document.close();
        if (trigger) trigger.classList.remove('generating');
    } catch (error) {
        docWindow.close();
        if (trigger) trigger.classList.remove('generating');
        showToast(error.message);
    }
}

// ORDER HISTORY AND ADMIN ORDER VIEW SETUP
function renderOrders(list, targetId, emptyMessage) {
    const target = document.getElementById(targetId);
    if (!target) return;
    if (!list.length) {
        target.innerHTML = `<div class="orders-empty">${emptyMessage}</div>`;
        return;
    }
    target.innerHTML = list.map(order => `
        <div class="order-card">
            <div class="order-card-head">
                <div>
                    <strong>Bill No. ${String(order.id || '').slice(0, 8).toUpperCase()}</strong>
                    <span>${formatDate(order.createdAt)}</span>
                </div>
                <div class="order-badges">
                    <div class="order-status ${String(order.paymentStatus).toLowerCase()}">${order.paymentMethod} · ${order.paymentStatus}</div>
                    <div class="order-status order-flow ${String(order.orderStatus || 'pending').toLowerCase()}">Order · ${titleCase(order.orderStatus || 'pending')}</div>
                </div>
            </div>
            <div class="order-items">${order.items.map(item => `${item.name} (${item.size}) × ${item.qty}`).join('<br>')}</div>
            ${buildOrderTimeline(order)}
            <div class="order-meta-line">Total: ₹${Number(order.total).toLocaleString()}${order.couponCode ? ` · Coupon: ${order.couponCode}` : ''}</div>
            ${order.paymentMethod === 'Partial COD' ? `<div class="order-meta-line">Paid Now: ₹${Number(order.depositAmount || 0).toLocaleString()} · Due on Delivery: ₹${Number(order.balanceDue || 0).toLocaleString()}</div>` : ''}
            ${order.courierName ? `<div class="order-meta-line">Courier: ${order.courierName}</div>` : ''}
            ${order.trackingId ? `<div class="order-meta-line">Tracking ID: ${order.trackingId}</div>` : ''}
            <div class="order-action-row">
                <button class="order-action-btn" onclick="openOrderDocument('${order.id}','invoice', event)">Invoice</button>
                <button class="order-action-btn" onclick="openOrderDocument('${order.id}','packing-slip', event)">Packing Slip</button>
                ${order.trackingId ? `<button class="order-action-btn" onclick="openTrackingLink(${JSON.stringify(order.courierName || '')}, ${JSON.stringify(order.trackingId)})">Track Package</button>` : ''}
            </div>
            ${targetId === 'adminOrdersList' ? `<div class="order-meta-line">${order.customerName} · ${order.customerPhone} · ${order.customerEmail || ''}</div>
            <div class="admin-quick-actions">
                <button class="admin-quick-btn" type="button" onclick="openAdminWhatsApp('${order.id}')">WhatsApp</button>
                <button class="admin-quick-btn" type="button" onclick="openAdminEmail('${order.id}')">Email</button>
                <button class="admin-quick-btn" type="button" onclick="copyAdminOrderSummary('${order.id}')">Copy Summary</button>
            </div>
            <div class="admin-status-row">
                <label for="order-status-${order.id}">Update status</label>
                <select id="order-status-${order.id}" onchange="updateAdminOrderStatus('${order.id}', this.value)">
                    ${ORDER_STATUSES.map(status => `<option value="${status}" ${status === (order.orderStatus || 'pending') ? 'selected' : ''}>${titleCase(status)}</option>`).join('')}
                </select>
            </div>
            <div class="admin-tracking-row">
                <input type="text" id="courier-name-${order.id}" value="${order.courierName || ''}" placeholder="Courier name">
                <input type="text" id="tracking-id-${order.id}" value="${order.trackingId || ''}" placeholder="Add tracking ID">
                <button type="button" onclick="saveOrderTrackingId('${order.id}')">Save Shipping</button>
            </div>` : ''}
        </div>
    `).join('');
}

function renderSubscribers(list, targetId, emptyMessage) {
    const target = document.getElementById(targetId);
    if (!target) return;
    if (!list.length) {
        target.innerHTML = `<div class="orders-empty">${emptyMessage}</div>`;
        return;
    }
    target.innerHTML = list.map(subscriber => `
        <div class="subscriber-card">
            <div>
                <strong>${subscriber.email}</strong>
                <span>${formatDate(subscriber.createdAt)}</span>
            </div>
            <div class="subscriber-actions">
                <span>${String(subscriber.id || '').slice(0, 8).toUpperCase()}</span>
                <button class="subscriber-delete" onclick="deleteSubscriber('${subscriber.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

function renderSimpleAdminCards(list, targetId, emptyMessage, formatter) {
    const target = document.getElementById(targetId);
    if (!target) return;
    if (!list.length) {
        target.innerHTML = `<div class="orders-empty">${emptyMessage}</div>`;
        return;
    }
    target.innerHTML = list.map(item => `
        <div class="subscriber-card">
            <div>${formatter(item)}</div>
        </div>
    `).join('');
}

function contactLead(email, phone, label) {
    if (phone) {
        const cleaned = String(phone).replace(/[^\d]/g, '');
        const message = `Hello from Ruh Imperium. We are following up regarding your ${label}.`;
        window.open(`https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`, '_blank');
        return;
    }
    if (email) {
        const subject = `Ruh Imperium follow-up`;
        const body = `Hello,%0D%0A%0D%0AWe are following up regarding your ${label}.`;
        window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${body}`;
        return;
    }
    showToast('No contact info is available for this lead.');
}

async function loadMyOrders() {
    if (!apiConfig.backendReady) {
        const localOrders = getLocalOrders().filter(order =>
            currentUser && (order.userId === currentUser.id || order.customerEmail === currentUser.email)
        ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        orderHistory = localOrders;
        renderOrders(orderHistory, 'ordersList', 'No orders yet. Your placed orders will appear here.');
        return;
    }
    if (!sessionToken) return;
    try {
        const data = await apiFetch('/api/orders', {}, true);
        orderHistory = data.orders || [];
        renderOrders(orderHistory, 'ordersList', 'No orders yet. Your placed orders will appear here.');
    } catch (error) {
        const localOrders = getLocalOrders().filter(order =>
            currentUser && (order.userId === currentUser.id || order.customerEmail === currentUser.email)
        ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        orderHistory = localOrders;
        renderOrders(orderHistory, 'ordersList', 'No orders yet. Your placed orders will appear here.');
    }
}

async function loadAdminOrders() {
    if (!currentUser || !currentUser.isAdmin) return;
    if (!apiConfig.backendReady) {
        buildLocalAdminSnapshot();
        renderAdminStats();
        renderAdminSetupReadiness();
        filterAdminOrders();
        filterAdminSubscribers();
        renderAdminExtras();
        return;
    }
    try {
        const [ordersData, statsData, subscribersData] = await Promise.all([
            apiFetch('/api/admin/orders', {}, true),
            apiFetch('/api/admin/stats', {}, true),
            apiFetch('/api/admin/subscribers', {}, true)
        ]);
        adminOrderHistory = ordersData.orders || [];
        adminStats = statsData.stats || null;
        adminSubscribers = subscribersData.subscribers || [];
        renderAdminStats();
        renderAdminSetupReadiness();
        filterAdminOrders();
        filterAdminSubscribers();
        renderAdminExtras();
    } catch (error) {
        buildLocalAdminSnapshot();
        renderAdminStats();
        renderAdminSetupReadiness();
        filterAdminOrders();
        filterAdminSubscribers();
        renderAdminExtras();
        showToast('Admin dashboard loaded in fallback mode.');
    }
}

// ADMIN LEADS AND MARKETPLACE ACTIONS SETUP
function renderAdminExtras() {
    renderSimpleAdminCards(
        getSellerApplications(),
        'sellerApplicationsList',
        'No seller applications yet.',
        item => `<strong>${item.businessName}</strong><span>${item.name} · ${item.email} · ${titleCase(item.status)}</span><span>${item.businessCategory}${item.phone ? ` · ${item.phone}` : ''}</span><div class="admin-quick-actions"><button class="admin-quick-btn" type="button" onclick="updateSellerApplicationStatus('${item.id}','approved')">Approve</button><button class="admin-quick-btn" type="button" onclick="updateSellerApplicationStatus('${item.id}','rejected')">Reject</button><button class="admin-quick-btn" type="button" onclick="contactLead(${JSON.stringify(item.email)}, ${JSON.stringify(item.phone)}, 'seller application')">Contact</button><button class="admin-quick-btn" type="button" onclick="deleteSellerApplication('${item.id}')">Remove</button></div>`
    );
    renderSimpleAdminCards(
        getSellerProducts(),
        'sellerProductsList',
        'No seller products submitted yet.',
        item => `<strong>${item.name}</strong><span>${item.sellerName} · ${item.sellerEmail}</span><span>${item.category} · ${formatCurrency(item.price)} · ${titleCase(item.status)}</span><span>${item.description || 'No description added yet.'}</span><div class="admin-quick-actions"><button class="admin-quick-btn" type="button" onclick="updateSellerProductStatus('${item.id}','approved')">Approve</button><button class="admin-quick-btn" type="button" onclick="updateSellerProductStatus('${item.id}','rejected')">Reject</button><button class="admin-quick-btn" type="button" onclick="deleteSellerProduct('${item.id}')">Remove</button></div>`
    );
    renderSimpleAdminCards(
        getViewSignals().filter(item => !item.purchased),
        'viewSignalsList',
        'No product-view leads yet.',
        item => `<strong>${item.productName}</strong><span>${item.email || 'Guest user'}${item.phone ? ` · ${item.phone}` : ''}</span><span>Viewed: ${formatDate(item.viewedAt)}</span><div class="admin-quick-actions"><button class="admin-quick-btn" type="button" onclick="contactLead(${JSON.stringify(item.email)}, ${JSON.stringify(item.phone)}, 'product interest')">Contact</button><button class="admin-quick-btn" type="button" onclick="markViewSignalPurchased('${item.id}')">Mark Purchased</button><button class="admin-quick-btn" type="button" onclick="dismissViewSignal('${item.id}')">Dismiss</button></div>`
    );
    renderSimpleAdminCards(
        getAbandonedCarts(),
        'abandonedCartsList',
        'No abandoned carts recorded yet.',
        item => `<strong>${item.customer || 'Guest'}</strong><span>${item.email || 'No email'}${item.phone ? ` · ${item.phone}` : ''}</span><span>${item.items.join(', ')}</span><span>Total: ${formatCurrency(item.total)}</span><div class="admin-quick-actions"><button class="admin-quick-btn" type="button" onclick="contactLead(${JSON.stringify(item.email)}, ${JSON.stringify(item.phone)}, 'abandoned cart')">Contact</button><button class="admin-quick-btn" type="button" onclick="markAbandonedCartRecovered('${item.id}')">Recovered</button><button class="admin-quick-btn" type="button" onclick="dismissAbandonedCart('${item.id}')">Dismiss</button></div>`
    );
    renderSimpleAdminCards(
        getStockAlerts(),
        'stockAlertsList',
        'No stock alerts yet.',
        item => `<strong>${item.productName}</strong><span>${item.email}</span><span>Subscribed: ${formatDate(item.createdAt)}</span><div class="admin-quick-actions"><button class="admin-quick-btn" type="button" onclick="contactLead(${JSON.stringify(item.email)}, '', 'stock alert update')">Notify</button><button class="admin-quick-btn" type="button" onclick="removeStockAlert('${item.id}')">Resolve</button></div>`
    );
}

function updateSellerApplicationStatus(applicationId, status) {
    const items = getSellerApplications().map(item => item.id === applicationId ? { ...item, status, updatedAt: new Date().toISOString() } : item);
    const updated = items.find(item => item.id === applicationId);
    saveSellerApplications(items);
    if (updated?.email) {
        updateStoredLocalUser(updated.email, { sellerStatus: status, isSeller: status === 'approved' });
        if (currentUser && String(currentUser.email || '').trim().toLowerCase() === String(updated.email || '').trim().toLowerCase()) {
            syncCurrentUserProfile({ sellerStatus: status, isSeller: status === 'approved' });
        }
    }
    renderAdminExtras();
    renderSellerDashboard();
    showToast(`Seller application ${titleCase(status)}.`);
}

function updateSellerProductStatus(productId, status) {
    const items = getSellerProducts().map(item => item.id === productId ? {
        ...item,
        status,
        catalogId: item.catalogId || Number(`9${String(item.id || '').replace(/\D/g, '').slice(-6) || Date.now()}`),
        updatedAt: new Date().toISOString()
    } : item);
    saveSellerProducts(items);
    syncMarketplaceProducts();
    renderAdminExtras();
    renderSellerDashboard();
    renderHomeSections();
    renderShopGrid();
    showToast(`Seller product ${titleCase(status)}.`);
}

function deleteSellerApplication(applicationId) {
    const next = getSellerApplications().filter(item => item.id !== applicationId);
    saveSellerApplications(next);
    renderAdminExtras();
    renderSellerDashboard();
    showToast('Seller application removed.');
}

function deleteSellerProduct(productId) {
    const next = getSellerProducts().filter(item => item.id !== productId);
    saveSellerProducts(next);
    syncMarketplaceProducts();
    renderAdminExtras();
    renderSellerDashboard();
    renderHomeSections();
    renderShopGrid();
    showToast('Seller product removed.');
}

function dismissViewSignal(signalId) {
    const next = getViewSignals().filter(item => item.id !== signalId);
    saveViewSignals(next);
    renderAdminExtras();
    showToast('Viewed-product lead dismissed.');
}

function markViewSignalPurchased(signalId) {
    const next = getViewSignals().map(item => item.id === signalId ? { ...item, purchased: true, updatedAt: new Date().toISOString() } : item);
    saveViewSignals(next);
    renderAdminExtras();
    showToast('Lead marked as converted.');
}

function dismissAbandonedCart(entryId) {
    const next = getAbandonedCarts().filter(item => item.id !== entryId);
    saveAbandonedCarts(next);
    renderAdminExtras();
    showToast('Abandoned cart dismissed.');
}

function markAbandonedCartRecovered(entryId) {
    const next = getAbandonedCarts().filter(item => item.id !== entryId);
    saveAbandonedCarts(next);
    renderAdminExtras();
    showToast('Abandoned cart marked as recovered.');
}

function removeStockAlert(alertId) {
    const next = getStockAlerts().filter(item => item.id !== alertId);
    saveStockAlerts(next);
    renderAdminExtras();
    showToast('Stock alert removed.');
}

// ADMIN DASHBOARD STATS SETUP
function renderAdminStats() {
    const summary = document.getElementById('adminStats');
    if (!summary) return;
    if (!adminStats) {
        summary.innerHTML = '';
        return;
    }
    const visitCount = Number(adminStats.totalVisits || getLocalTrafficStats().totalVisits || 0);
    summary.innerHTML = `
        <div class="stat-card"><span>Total Orders</span><strong>${adminStats.totalOrders}</strong></div>
        <div class="stat-card"><span>Pending</span><strong>${adminStats.pendingOrders}</strong></div>
        <div class="stat-card"><span>Shipped</span><strong>${adminStats.shippedOrders}</strong></div>
        <div class="stat-card"><span>Revenue</span><strong>₹${Number(adminStats.totalRevenue).toLocaleString()}</strong></div>
        <div class="stat-card"><span>Visitors</span><strong>${visitCount.toLocaleString()}</strong></div>
    `;
}

function filterAdminOrders() {
    const searchInput = document.getElementById('adminOrderSearch');
    const statusFilter = document.getElementById('adminOrderStatusFilter');
    const query = (searchInput?.value || '').trim().toLowerCase();
    const status = (statusFilter?.value || 'all').toLowerCase();
    const filtered = adminOrderHistory.filter(order => {
        const matchesStatus = status === 'all' || String(order.orderStatus || 'pending').toLowerCase() === status;
        const matchesPreset = (
            adminFilterPreset === 'all' ||
            (adminFilterPreset === 'needs-tracking' && (order.orderStatus === 'shipped' || order.orderStatus === 'confirmed') && !String(order.trackingId || '').trim()) ||
            (adminFilterPreset === 'paid' && String(order.paymentStatus || '').toLowerCase() === 'paid') ||
            (adminFilterPreset === 'cod' && String(order.paymentMethod || '').toLowerCase() === 'cod') ||
            (adminFilterPreset === 'today' && new Date(order.createdAt).toDateString() === new Date().toDateString())
        );
        const haystack = [
            order.id,
            order.customerName,
            order.customerEmail,
            order.customerPhone,
            order.paymentMethod,
            order.couponCode,
            ...(order.items || []).map(item => item.name)
        ].join(' ').toLowerCase();
        const matchesQuery = !query || haystack.includes(query);
        return matchesStatus && matchesQuery && matchesPreset;
    });
    renderOrders(filtered, 'adminOrdersList', 'No orders match the current filters.');
    const count = document.getElementById('adminOrderCount');
    if (count) count.textContent = `${filtered.length} orders shown`;
}

function setAdminFilterPreset(preset) {
    adminFilterPreset = preset || 'all';
    const buttons = document.querySelectorAll('[data-admin-preset]');
    buttons.forEach(button => button.classList.toggle('active', button.dataset.adminPreset === adminFilterPreset));
    filterAdminOrders();
}

function filterAdminSubscribers() {
    const searchInput = document.getElementById('adminSubscriberSearch');
    const query = (searchInput?.value || '').trim().toLowerCase();
    const filtered = adminSubscribers.filter(subscriber => {
        const haystack = [subscriber.email, subscriber.id, subscriber.createdAt].join(' ').toLowerCase();
        return !query || haystack.includes(query);
    });
    renderSubscribers(filtered, 'adminSubscribersList', 'No subscribers found yet.');
    const count = document.getElementById('adminSubscriberCount');
    if (count) count.textContent = `${filtered.length} subscribers shown`;
}

async function updateAdminOrderStatus(orderId, orderStatus) {
    if (!currentUser || !currentUser.isAdmin) return;
    if (!apiConfig.backendReady) {
        const orders = getLocalOrders();
        const order = orders.find(item => item.id === orderId);
        if (!order) {
            showToast('Order not found.');
            return;
        }
        order.orderStatus = orderStatus;
        order.updatedAt = new Date().toISOString();
        saveLocalOrders(orders);
        showToast(`Order marked as ${titleCase(orderStatus)}.`);
        await loadAdminOrders();
        await loadMyOrders();
        return;
    }
    try {
        await apiFetch(`/api/admin/orders/${orderId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ orderStatus })
        }, true);
        showToast(`Order marked as ${titleCase(orderStatus)}.`);
        await loadAdminOrders();
        await loadMyOrders();
    } catch (error) {
        if (isRecoverableApiError(error.message)) {
            const orders = getLocalOrders();
            const order = orders.find(item => item.id === orderId);
            if (!order) {
                showToast('Order not found.');
                return;
            }
            order.orderStatus = orderStatus;
            order.updatedAt = new Date().toISOString();
            saveLocalOrders(orders);
            await loadAdminOrders();
            await loadMyOrders();
            showToast(`Order marked as ${titleCase(orderStatus)}.`);
            return;
        }
        showToast(error.message);
    }
}

async function saveOrderTrackingId(orderId) {
    if (!currentUser || !currentUser.isAdmin) return;
    const courierInput = document.getElementById(`courier-name-${orderId}`);
    const input = document.getElementById(`tracking-id-${orderId}`);
    if (!input || !courierInput) return;
    const courierName = courierInput.value.trim();
    const trackingId = input.value.trim();
    if (!apiConfig.backendReady) {
        const orders = getLocalOrders();
        const order = orders.find(item => item.id === orderId);
        if (!order) {
            showToast('Order not found.');
            return;
        }
        order.courierName = courierName;
        order.trackingId = trackingId;
        order.updatedAt = new Date().toISOString();
        saveLocalOrders(orders);
        adminOrderHistory = orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        filterAdminOrders();
        await loadMyOrders();
        showToast(courierName || trackingId ? 'Shipping details saved.' : 'Shipping details cleared.');
        return;
    }
    try {
        const data = await apiFetch(`/api/admin/orders/${orderId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ courierName, trackingId })
        }, true);
        adminOrderHistory = adminOrderHistory.map(order => order.id === orderId ? { ...order, ...data.order } : order);
        filterAdminOrders();
        await loadMyOrders();
        showToast(courierName || trackingId ? 'Shipping details saved.' : 'Shipping details cleared.');
    } catch (error) {
        showToast(error.message);
    }
}

async function exportAdminOrdersCsv() {
    if (!currentUser || !currentUser.isAdmin || !sessionToken) return;
    if (!apiConfig.backendReady) {
        exportAdminOrdersCsvLocal();
        return;
    }
    try {
        const response = await fetch('/api/admin/orders/export.csv', {
            headers: {
                Authorization: `Bearer ${sessionToken}`
            }
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || 'Unable to export orders.');
        }
        const csvText = await response.text();
        const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ruh-imperium-orders-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        showToast('Orders CSV exported.');
    } catch (error) {
        if (isRecoverableApiError(error.message)) {
            buildLocalAdminSnapshot();
            exportAdminOrdersCsvLocal();
            return;
        }
        showToast(error.message);
    }
}

function exportAdminOrdersCsvLocal() {
    const rows = [
        ['Order ID', 'Created At', 'Customer Name', 'Customer Email', 'Customer Phone', 'Payment Method', 'Payment Status', 'Order Status', 'Coupon Code', 'Subtotal', 'Discount', 'Total', 'Items'],
        ...adminOrderHistory.map(order => [
            order.id,
            order.createdAt,
            order.customerName,
            order.customerEmail,
            order.customerPhone,
            order.paymentMethod,
            order.paymentStatus,
            order.orderStatus || 'pending',
            order.couponCode || '',
            order.subtotal,
            order.discount,
            order.total,
            (order.items || []).map(item => `${item.name} (${item.size}) x ${item.qty}`).join(' | ')
        ])
    ];
    const csvText = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ruh-imperium-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Orders CSV exported.');
}

async function exportAdminSubscribersCsv() {
    if (!currentUser || !currentUser.isAdmin || !sessionToken) return;
    if (!apiConfig.backendReady) {
        exportAdminSubscribersCsvLocal();
        return;
    }
    try {
        const response = await fetch('/api/admin/subscribers/export.csv', {
            headers: {
                Authorization: `Bearer ${sessionToken}`
            }
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || 'Unable to export subscribers.');
        }
        const csvText = await response.text();
        const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ruh-imperium-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        showToast('Subscribers CSV exported.');
    } catch (error) {
        if (isRecoverableApiError(error.message)) {
            buildLocalAdminSnapshot();
            exportAdminSubscribersCsvLocal();
            return;
        }
        showToast(error.message);
    }
}

function exportAdminSubscribersCsvLocal() {
    const rows = [
        ['Subscriber ID', 'Email', 'Created At'],
        ...adminSubscribers.map(subscriber => [subscriber.id, subscriber.email, subscriber.createdAt])
    ];
    const csvText = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ruh-imperium-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Subscribers CSV exported.');
}

async function copyAllSubscriberEmails() {
    if (!currentUser || !currentUser.isAdmin) return;
    if (!adminSubscribers.length) {
        showToast('No subscribers to copy.');
        return;
    }
    const emailList = adminSubscribers.map(subscriber => subscriber.email).join(', ');
    try {
        await navigator.clipboard.writeText(emailList);
        showToast('All subscriber emails copied.');
    } catch (error) {
        showToast('Unable to copy emails right now.');
    }
}

async function deleteSubscriber(subscriberId) {
    if (!currentUser || !currentUser.isAdmin) return;
    if (!subscriberId) return;
    if (!apiConfig.backendReady) {
        const remaining = adminSubscribers.filter(subscriber => subscriber.id !== subscriberId);
        if (remaining.length === adminSubscribers.length) {
            showToast('Subscriber not found.');
            return;
        }
        adminSubscribers = remaining;
        saveLocalNewsletterSubscribers(adminSubscribers.map(subscriber => subscriber.email));
        filterAdminSubscribers();
        showToast('Subscriber deleted.');
        return;
    }
    try {
        await apiFetch(`/api/admin/subscribers/${subscriberId}`, {
            method: 'DELETE'
        }, true);
        adminSubscribers = adminSubscribers.filter(subscriber => subscriber.id !== subscriberId);
        filterAdminSubscribers();
        showToast('Subscriber deleted.');
    } catch (error) {
        showToast(error.message);
    }
}

function openOrdersModal() {
    if (!currentUser) {
        showToast('Please sign in to view orders.');
        openAuthModal();
        return;
    }
    loadMyOrders();
    if (currentUser.isAdmin) loadAdminOrders();
    setAdminFilterPreset(adminFilterPreset || 'all');
    document.getElementById('ordersModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeOrdersModal() {
    document.getElementById('ordersModal').classList.remove('open');
    document.body.style.overflow = '';
}

function openSearch() {
    document.getElementById('searchOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('searchInput').focus(), 100);
}

function closeSearch() {
    document.getElementById('searchOverlay').classList.remove('open');
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResults').innerHTML = '';
    document.body.style.overflow = '';
}

function doSearch(query) {
    const resultsEl = document.getElementById('searchResults');
    if (!query.trim()) {
        resultsEl.innerHTML = '';
        return;
    }
    const results = products.filter(product =>
        product.name.toLowerCase().includes(query.toLowerCase()) ||
        product.cat.toLowerCase().includes(query.toLowerCase()) ||
        product.notes.toLowerCase().includes(query.toLowerCase()) ||
        product.desc.toLowerCase().includes(query.toLowerCase())
    );
    if (results.length === 0) {
        resultsEl.innerHTML = `<div style="color:rgba(253,246,232,0.4);font-family:'Cormorant Garamond',serif;font-size:18px;font-style:italic;padding:20px 0;">No attars found. Try a different search.</div>`;
        return;
    }
    resultsEl.innerHTML = results.slice(0, 6).map(product => `
    <div class="search-result-item" onclick="searchSelect(${product.id})">
      <img class="sri-img" src="${product.img}" alt="${product.name}" onerror="this.style.display='none'">
      <div class="sri-info">
        <h4>${product.name}</h4>
        <p>${product.cat} · ₹${product.price.toLocaleString()}</p>
      </div>
    </div>`).join('');
}

function searchSelect(id) {
    closeSearch();
    openProductModal(id);
}

function updateNewsletterStatus(message = '', type = '') {
    const status = document.getElementById('nlStatus');
    if (!status) return;
    status.textContent = message;
    status.className = type ? `nl-status ${type}` : 'nl-status';
}

function isValidEmailAddress(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function handleNewsletterKeydown(event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    subscribe();
}

// NEWSLETTER SUBSCRIPTION SETUP
async function subscribe() {
    const input = document.getElementById('nlEmail');
    const button = document.getElementById('nlSubmitBtn');
    const email = input.value.trim().toLowerCase();
    if (!isValidEmailAddress(email)) {
        updateNewsletterStatus('Please enter a valid email address.', 'error');
        showToast('Please enter a valid email address.');
        return;
    }

    button.disabled = true;
    button.textContent = 'Saving...';
    updateNewsletterStatus('Saving your email...', '');

    if (!apiConfig.backendReady) {
        const subscribers = getLocalNewsletterSubscribers();
        if (!subscribers.includes(email)) {
            subscribers.push(email);
            saveLocalNewsletterSubscribers(subscribers);
        }
        input.value = '';
        button.disabled = false;
        button.textContent = 'Subscribe';
        updateNewsletterStatus('You are subscribed. We will keep you posted on launches and offers.', 'success');
        showToast('Subscribed successfully.');
        return;
    }

    try {
        const data = await apiFetch('/api/newsletter/subscribe', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
        input.value = '';
        updateNewsletterStatus(
            data.alreadySubscribed
                ? 'This email is already subscribed.'
                : 'You are subscribed. We will keep you posted on launches and offers.',
            'success'
        );
        showToast(data.alreadySubscribed ? 'Already subscribed.' : 'Subscribed successfully.');
    } catch (error) {
        updateNewsletterStatus(error.message, 'error');
        showToast(error.message);
    } finally {
        button.disabled = false;
        button.textContent = 'Subscribe';
    }
}

function setAuthMode(mode) {
    authMode = mode === 'signup' ? 'signup' : 'login';
    const isSignup = mode === 'signup';
    document.getElementById('loginTab').classList.toggle('active', !isSignup);
    document.getElementById('signupTab').classList.toggle('active', isSignup);
    document.getElementById('authTitle').textContent = isSignup ? 'Create Your Account' : 'Welcome Back';
    document.getElementById('authSubtitle').textContent = isSignup
        ? (apiConfig.backendReady ? 'Create your account on the backend so checkout and payments stay tied to a real user profile.' : 'Create an account saved in this browser so your details and orders still work on the live site.')
        : (apiConfig.backendReady ? 'Sign in to access saved details, backend coupon validation, and Razorpay checkout.' : 'Sign in to your browser-saved account. Cash on Delivery and order history will still work.');
    document.getElementById('authName').parentElement.style.display = isSignup ? 'block' : 'none';
    document.getElementById('authPhone').parentElement.style.display = isSignup ? 'block' : 'none';
    document.getElementById('authPassword').parentElement.style.display = 'block';
    document.getElementById('authSubmitBtn').textContent = isSignup ? 'Create Account' : 'Sign In';
    document.getElementById('authAltCopy').innerHTML = isSignup
        ? 'Already have an account? <a class="auth-link" onclick="setAuthMode(\'login\')">Sign in</a>'
        : 'New here? <a class="auth-link" onclick="setAuthMode(\'signup\')">Create an account</a>';
}

function openAuthModal() {
    renderAuthView();
    document.getElementById('authModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeAuthModal() {
    document.getElementById('authModal').classList.remove('open');
    document.body.style.overflow = '';
}

// AUTHENTICATION UI SETUP
function renderAuthView() {
    const guestView = document.getElementById('authGuestView');
    const userView = document.getElementById('authUserView');
    const cardBadge = document.getElementById('accountAdminBadgeCard');
    if (currentUser) {
        guestView.style.display = 'none';
        userView.style.display = 'block';
        document.getElementById('accountName').textContent = currentUser.isAdmin
            ? `${currentUser.name || 'Ruh Imperium Customer'} (Admin)`
            : (currentUser.name || 'Ruh Imperium Customer');
        document.getElementById('accountEmail').textContent = currentUser.email || 'No email saved';
        document.getElementById('accountPhone').textContent = currentUser.phone || 'No phone saved';
        if (cardBadge) cardBadge.classList.toggle('show', Boolean(currentUser.isAdmin));
        renderSellerDashboard();
    } else {
        guestView.style.display = 'block';
        userView.style.display = 'none';
        if (cardBadge) cardBadge.classList.remove('show');
        setAuthMode(authMode);
    }
}

function updateAccountUI() {
    const label = document.getElementById('accountLabel');
    const initial = document.getElementById('accountInitial');
    const badge = document.getElementById('accountAdminBadge');
    const topBadge = document.getElementById('topAdminBadge');
    if (currentUser) {
        label.textContent = currentUser.name.split(' ')[0];
        initial.textContent = currentUser.name.charAt(0).toUpperCase();
        if (badge) badge.classList.toggle('show', Boolean(currentUser.isAdmin));
        if (topBadge) topBadge.classList.toggle('show', Boolean(currentUser.isAdmin));
    } else {
        label.textContent = 'Account';
        initial.textContent = 'A';
        if (badge) badge.classList.remove('show');
        if (topBadge) topBadge.classList.remove('show');
    }
    const ordersBtn = document.getElementById('ordersBtn');
    const adminTab = document.getElementById('adminOrdersTab');
    if (ordersBtn) ordersBtn.style.display = currentUser ? 'flex' : 'none';
    if (adminTab) adminTab.style.display = currentUser && currentUser.isAdmin ? 'block' : 'none';
    renderAuthView();
    renderBackendStatus();
    renderAdminSetupReadiness();
    renderCartItems();
}

function completeSignedInState(successMessage) {
    persistUser();
    updateAccountUI();
    prefillCheckout();
    closeAuthModal();
    showToast(successMessage);
}

function signUpLocally(name, email, phone, password) {
    if (!password || password.length < 6) {
        throw new Error('Use a password with at least 6 characters.');
    }
    const users = getLocalUsers();
    if (users.some(user => user.email === email)) {
        throw new Error('An account with this email already exists.');
    }
    currentUser = {
        id: 'local-user-' + Date.now(),
        name,
        email,
        phone,
        password,
        isAdmin: false
    };
    currentUser = applyAdminAccess(currentUser);
    users.push(currentUser);
    saveLocalUsers(users);
    sessionToken = 'local-session';
}

function loginLocally(email, password) {
    const users = getLocalUsers();
    const savedUser = users.find(user => user.email === email && user.password === password);
    if (!savedUser) {
        throw new Error('Invalid email or password.');
    }
    currentUser = applyAdminAccess(savedUser);
    sessionToken = 'local-session';
}

function getLocalUserByEmail(email) {
    return getLocalUsers().find(user => user.email === email) || null;
}

// AUTHENTICATION FLOW SETUP
async function handleAuth() {
    const name = document.getElementById('authName').value.trim();
    const email = document.getElementById('authEmail').value.trim().toLowerCase();
    const phone = document.getElementById('authPhone').value.trim();
    const password = document.getElementById('authPassword').value.trim();
    if (!email) {
        showToast('Email is required.');
        return;
    }
    if (authMode === 'login' && !password) {
        showToast('Email and password are required.');
        return;
    }
    if (authMode === 'signup' && (!name || !phone)) {
        showToast('Please complete all signup fields.');
        return;
    }
    if (authMode === 'signup' && password.length < 6) {
        showToast('Use a password with at least 6 characters.');
        return;
    }
    if (!apiConfig.backendReady) {
        try {
            if (authMode === 'signup') {
                signUpLocally(name, email, phone, password);
                completeSignedInState('Account created successfully.');
                return;
            }
            loginLocally(email, password);
            completeSignedInState('Signed in successfully.');
        } catch (error) {
            showToast(error.message);
        }
        return;
    }
    try {
        const path = authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
        const data = await apiFetch(path, {
            method: 'POST',
            body: JSON.stringify({ name, email, phone, password })
        });
        currentUser = applyAdminAccess(data.user);
        sessionToken = data.token;
        completeSignedInState(authMode === 'signup' ? 'Account created successfully.' : 'Signed in successfully.');
    } catch (error) {
        if (authMode === 'login') {
            try {
                loginLocally(email, password);
                const localUser = currentUser;
                try {
                    const syncData = await apiFetch('/api/auth/signup', {
                        method: 'POST',
                        body: JSON.stringify({
                            name: localUser.name || name || 'Ruh Imperium Customer',
                            email: localUser.email,
                            phone: localUser.phone || phone,
                            password
                        })
                    });
                    currentUser = applyAdminAccess(syncData.user);
                    sessionToken = syncData.token;
                    completeSignedInState('Signed in successfully.');
                    return;
                } catch (syncError) {
                    const syncMessage = String(syncError.message || '').toLowerCase();
                    if (syncMessage.includes('already exists')) {
                        try {
                            const loginData = await apiFetch('/api/auth/login', {
                                method: 'POST',
                                body: JSON.stringify({ email, password })
                            });
                            currentUser = applyAdminAccess(loginData.user);
                            sessionToken = loginData.token;
                            completeSignedInState('Signed in successfully.');
                            return;
                        } catch (retryError) {
                            showToast(retryError.message);
                            return;
                        }
                    }
                    completeSignedInState('Signed in successfully.');
                    return;
                }
            } catch (localError) {
                if (String(error.message || '').toLowerCase().includes('invalid email or password')) {
                    const localUser = getLocalUserByEmail(email);
                    if (localUser) {
                        showToast('Your account exists locally, but the password did not match. Try the password you used when creating the account.');
                        return;
                    }
                    showToast('No matching account was found. Please create the account again once and then sign in.');
                    return;
                }
            }
        }
        if (authMode === 'signup' && isRecoverableApiError(error.message)) {
            try {
                signUpLocally(name, email, phone, password);
                completeSignedInState('Account created successfully.');
                return;
            } catch (localError) {
                const localUser = getLocalUserByEmail(email);
                if (localUser) {
                    if (localUser.password === password) {
                        loginLocally(email, password);
                        completeSignedInState('This account already existed locally, so you were signed in directly.');
                        return;
                    }
                    showToast('This email already exists on this device. Try signing in with the same password.');
                    return;
                }
                showToast(localError.message || 'Account could not be created right now.');
                return;
            }
        }
        if (authMode === 'signup' && String(error.message || '').toLowerCase().includes('already exists')) {
            try {
                loginLocally(email, password);
                completeSignedInState('This account already existed, so you were signed in directly.');
                return;
            } catch (localError) {
                try {
                    const loginData = await apiFetch('/api/auth/login', {
                        method: 'POST',
                        body: JSON.stringify({ email, password })
                    });
                    currentUser = applyAdminAccess(loginData.user);
                    sessionToken = loginData.token;
                    completeSignedInState('This account already existed, so you were signed in directly.');
                    return;
                } catch (retryError) {
                    showToast('This email is already registered. Try signing in with the same password.');
                    return;
                }
            }
        }
        showToast(error.message);
    }
}

async function requestOtp() {
    showToast('OTP login has been removed.');
}

async function verifyOtpLogin({ email, phone, otp }) {
    showToast('OTP login has been removed.');
}

function logout() {
    clearUserState();
    orderHistory = [];
    adminOrderHistory = [];
    adminStats = null;
    adminSubscribers = [];
    updateAccountUI();
    renderAdminStats();
    renderOrders([], 'ordersList', 'Sign in to view your orders.');
    renderOrders([], 'adminOrdersList', 'Admin orders will appear here.');
    renderSubscribers([], 'adminSubscribersList', 'Newsletter subscribers will appear here.');
    closeAuthModal();
    showToast('You have been logged out.');
}

function initReveals() {
    const reveals = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('visible');
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    reveals.forEach(item => observer.observe(item));
}

document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        closeSearch();
        closeProductModal();
        closeCheckout();
        closeAuthModal();
        closeOrdersModal();
    }
});

// APPLICATION INIT SETUP
async function initApp() {
    registerSiteVisit();
    loadStoredState();
    await loadApiConfig();
    populateReviewProductOptions();
    renderHomeSections();
    renderCustomerReviews();
    updateWishBadge();
    updateCartBadge();
    updateAccountUI();
    renderBackendStatus();
    renderAdminSetupReadiness();
    updateCouponUI();
    updateOrderSummary();
    prefillCheckout();
    updatePaymentOptionsUI();
    renderCartItems();
    const currencySelect = document.getElementById('currencySelector');
    if (currencySelect) currencySelect.value = selectedCurrency;
    ['cName', 'cPhone', 'cEmail', 'cAddress', 'cCity', 'cPin', 'cState'].forEach(id => {
        const element = document.getElementById(id);
        if (!element) return;
        element.addEventListener('input', handleCheckoutIdentityChange);
        element.addEventListener('change', handleCheckoutIdentityChange);
        element.addEventListener('input', updatePinServiceability);
        element.addEventListener('change', updatePinServiceability);
    });
    const backupImportInput = document.getElementById('backupImportInput');
    if (backupImportInput) {
        backupImportInput.addEventListener('change', handleBackupImport);
    }
    updateCheckoutOtpUI();
    updatePinServiceability();
    if (currentUser) loadMyOrders();
    initReveals();
}

initApp();
