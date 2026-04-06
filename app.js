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
const LOCAL_COUPONS = {
    RAMJI20: { code: 'RAMJI20', label: 'Ram Ji Signature Offer', type: 'percent', value: 20 },
    WELCOME10: { code: 'WELCOME10', label: 'Welcome Offer', type: 'percent', value: 10 },
    ATTAR250: { code: 'ATTAR250', label: 'Flat Rs. 250 Off', type: 'flat', value: 250, minOrder: 1500 }
};
const FALLBACK_ADMIN_EMAIL = 'sadityasingh7990@gmail.com';

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
let apiConfig = { backendReady: false, razorpayKeyId: '', adminEnabled: false, adminEmail: '', otpDelivery: 'preview' };
let orderHistory = [];
let adminOrderHistory = [];
let adminStats = null;
let adminSubscribers = [];
let adminFilterPreset = 'all';
let otpRequestedFor = '';
const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered'];
let recentlyViewed = [];

function loadStoredState() {
    try {
        cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
        wishlist = JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY) || '[]');
        currentUser = JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || 'null');
        sessionToken = localStorage.getItem(SESSION_STORAGE_KEY) || '';
        appliedCoupon = JSON.parse(localStorage.getItem(COUPON_STORAGE_KEY) || 'null');
        recentlyViewed = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY) || '[]');
    } catch (error) {
        cart = [];
        wishlist = [];
        currentUser = null;
        sessionToken = '';
        appliedCoupon = null;
        recentlyViewed = [];
    }
}

function applyAdminAccess(user) {
    if (!user) return user;
    const adminEmail = String(apiConfig.adminEmail || FALLBACK_ADMIN_EMAIL).trim().toLowerCase();
    return {
        ...user,
        isAdmin: Boolean(adminEmail) && String(user.email || '').trim().toLowerCase() === adminEmail
    };
}

function persistState() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlist));
    localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(appliedCoupon));
    localStorage.setItem(RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify(recentlyViewed));
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

function getLocalCoupon(code, subtotal) {
    const coupon = LOCAL_COUPONS[String(code || '').trim().toUpperCase()];
    if (!coupon) throw new Error('Invalid coupon code.');
    if (coupon.minOrder && subtotal < coupon.minOrder) {
        throw new Error(`Coupon works on orders above ₹${coupon.minOrder}.`);
    }
    const discountAmount = coupon.type === 'percent'
        ? Math.round(subtotal * (coupon.value / 100))
        : Math.min(coupon.value, subtotal);
    return { ...coupon, discountAmount, subtotal, finalTotal: Math.max(subtotal - discountAmount, 0) };
}

function buildLocalOrder(details, paymentMethod, paymentStatus, orderStatus) {
    const pricing = getOrderPricing();
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
        total: pricing.total,
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
        totalRevenue: adminOrderHistory.reduce((sum, order) => sum + Number(order.total || 0), 0)
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
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${title}</title><style>body{font-family:Arial,sans-serif;background:#eef3f9;margin:0;color:#162742}.sheet{max-width:900px;margin:24px auto;background:#fff;border:1px solid #d6e1ee;padding:32px;box-shadow:0 18px 50px rgba(17,34,55,0.08)}.top{display:flex;justify-content:space-between;gap:24px;margin-bottom:28px}.brand h1{margin:0;font-size:30px;color:#162742}.brand p,.meta p{margin:6px 0;color:#53657e;line-height:1.5}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.card{border:1px solid #dbe5f0;background:#f8fbff;padding:16px}.card p{margin:10px 0}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #dde6f0;padding:10px;text-align:left;font-size:14px}th{background:#edf4fb;color:#23415f}.summary{margin-top:20px;margin-left:auto;max-width:320px}.summary-line{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e0e8f1}.summary-line.total{font-size:18px;font-weight:700;border-bottom:none;color:#162742}@media print{body{background:#fff}.sheet{margin:0;border:none;box-shadow:none}}</style></head><body><div class="sheet"><div class="top"><div class="brand"><h1>Ruh Imperium</h1><p>Pure Indian Fragrances · Since 1973</p><p>Kannauj, Uttar Pradesh</p></div><div class="meta"><p><strong>${title}</strong></p><p>Order ID: ${order.id}</p><p>Date: ${formatDate(order.createdAt)}</p><p>Payment: ${order.paymentMethod} · ${order.paymentStatus}</p></div></div><div class="grid"><div class="card"><p><strong>${order.customerName}</strong></p><p>${order.customerEmail || ''}</p><p>${order.customerPhone || ''}</p></div><div class="card"><p>${address.address || ''}</p><p>${address.city || ''}, ${address.state || ''} - ${address.pin || ''}</p><p>Order Status: ${order.orderStatus || 'pending'}</p>${order.courierName ? `<p>Courier: ${order.courierName}</p>` : ''}${order.trackingId ? `<p>Tracking ID: ${order.trackingId}</p>` : ''}</div></div><table><thead>${type === 'packing-slip' ? '<tr><th>Item</th><th>Size</th><th>Qty</th></tr>' : '<tr><th>Item</th><th>Size</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>'}</thead><tbody>${rows}</tbody></table><div class="summary"><div class="summary-line"><span>Subtotal</span><strong>₹${Number(order.subtotal || 0).toLocaleString()}</strong></div>${type === 'packing-slip' ? `${order.courierName ? `<div class="summary-line"><span>Courier</span><strong>${order.courierName}</strong></div>` : ''}${order.trackingId ? `<div class="summary-line"><span>Tracking ID</span><strong>${order.trackingId}</strong></div>` : ''}` : `<div class="summary-line"><span>Coupon</span><strong>${order.couponCode || 'None'}</strong></div><div class="summary-line"><span>Discount</span><strong>₹${Number(order.discount || 0).toLocaleString()}</strong></div>${order.courierName ? `<div class="summary-line"><span>Courier</span><strong>${order.courierName}</strong></div>` : ''}${order.trackingId ? `<div class="summary-line"><span>Tracking ID</span><strong>${order.trackingId}</strong></div>` : ''}<div class="summary-line total"><span>Total</span><strong>₹${Number(order.total || 0).toLocaleString()}</strong></div>`}</div></div></body></html>`;
}

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

async function loadApiConfig() {
    try {
        const data = await apiFetch('/api/config');
        apiConfig = {
            backendReady: true,
            razorpayKeyId: data.razorpayKeyId || '',
            adminEnabled: Boolean(data.adminEnabled),
            adminEmail: String(data.adminEmail || '').trim().toLowerCase(),
            otpDelivery: data.otpDelivery || 'preview'
        };
        currentUser = applyAdminAccess(currentUser);
        persistUser();
    } catch (error) {
        apiConfig = { backendReady: false, razorpayKeyId: '', adminEnabled: false, adminEmail: '', otpDelivery: 'preview' };
    }
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
            <span class="product-price">₹${product.price.toLocaleString()}</span>
            ${product.oldPrice ? `<span class="product-price-old">₹${product.oldPrice.toLocaleString()}</span>` : ''}
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
    const existing = cart.find(item => item.id === product.id && item.size === size);
    if (existing) existing.qty++;
    else cart.push({ id: product.id, name: product.name, img: product.img, price: product.price, size, qty: 1 });
    resetCouponState();
    persistState();
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
        <div class="cart-item-price">₹${(item.price * item.qty).toLocaleString()} · ${item.size}</div>
        <div class="cart-qty-row">
          <button class="qty-btn" onclick="changeQty(${index},-1)">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty(${index},1)">+</button>
        </div>
      </div>
      <button class="cart-item-del" onclick="removeFromCart(${index})">🗑</button>
    </div>`).join('');
    document.getElementById('cartTotal').textContent = '₹' + getOrderPricing().total.toLocaleString();
}

function changeQty(index, delta) {
    cart[index].qty += delta;
    if (cart[index].qty <= 0) cart.splice(index, 1);
    resetCouponState();
    persistState();
    updateCartBadge();
    renderCartItems();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    resetCouponState();
    persistState();
    updateCartBadge();
    renderCartItems();
}

function getCartTotal() {
    return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function getDiscountAmount() {
    return appliedCoupon ? appliedCoupon.discountAmount || 0 : 0;
}

function getOrderPricing() {
    const subtotal = getCartTotal();
    const discount = getDiscountAmount();
    return {
        subtotal,
        discount,
        delivery: 0,
        total: Math.max(subtotal - discount, 0)
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

async function applyCoupon() {
    const code = document.getElementById('couponCode').value.trim().toUpperCase();
    if (!code) {
        showToast('Enter a coupon code first.');
        return;
    }
    if (!apiConfig.backendReady) {
        try {
            appliedCoupon = getLocalCoupon(code, getCartTotal());
            persistState();
            updateCouponUI();
            renderCartItems();
            updateOrderSummary();
            showToast(`${code} applied successfully.`);
        } catch (error) {
            showToast(error.message);
        }
        return;
    }
    try {
        const data = await apiFetch('/api/coupons/validate', {
            method: 'POST',
            body: JSON.stringify({ code, cart })
        });
        appliedCoupon = data.coupon;
        persistState();
        updateCouponUI();
        renderCartItems();
        updateOrderSummary();
        showToast(`${code} applied successfully.`);
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
            buildLocalAdminSnapshot();
            filterAdminOrders();
            await loadMyOrders();
            showToast(`Order marked as ${titleCase(orderStatus)}.`);
            return;
        }
        showToast(error.message);
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

    document.getElementById('modalCat').textContent = product.cat;
    document.getElementById('modalName').textContent = product.name;
    document.getElementById('modalStars').innerHTML = starStr(product.stars) + ` <span>(${product.reviews} reviews)</span>`;
    document.getElementById('modalPrice').textContent = '₹' + product.price.toLocaleString();
    document.getElementById('modalOldPrice').textContent = product.oldPrice ? '₹' + product.oldPrice.toLocaleString() : '';
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

    document.getElementById('modalAddBtn').onclick = () => {
        addToCart(product, selectedSize);
        closeProductModal();
        openCart();
    };

    document.getElementById('modalWaBtn').onclick = () => {
        const msg = `Hello! I am interested in *${product.name}* (${selectedSize}) at ₹${product.price.toLocaleString()}. Please help me place an order.`;
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
            const msg = `Hello! I am interested in *${currentProduct.name}* (${size}) at ₹${currentProduct.price.toLocaleString()}. Please help me place an order.`;
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
    summary.innerHTML = '<h3>Order Summary</h3>' +
        cart.map(item =>
            `<div class="order-line"><span>${item.name} (${item.size}) × ${item.qty}</span><span>₹${(item.price * item.qty).toLocaleString()}</span></div>`
        ).join('') +
        `<div class="order-line"><span>Subtotal</span><span>₹${pricing.subtotal.toLocaleString()}</span></div>` +
        couponLine +
        `<div class="order-line"><span>Delivery</span><span style="color:var(--green)">FREE</span></div>` +
        `<div class="order-line"><span>Total</span><span>₹${pricing.total.toLocaleString()}</span></div>`;
}

function selectPay(btn, type) {
    selectedPayment = type;
    document.querySelectorAll('.pay-opt').forEach(item => item.classList.remove('active'));
    btn.classList.add('active');
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
        msg += `• ${item.name} (${item.size}) × ${item.qty} = ₹${(item.price * item.qty).toLocaleString()}\n`;
    });
    if (appliedCoupon) msg += `\n*Coupon:* ${appliedCoupon.code} (-₹${pricing.discount.toLocaleString()})\n`;
    msg += `\n*Total: ₹${pricing.total.toLocaleString()}*`;
    return msg;
}

function finalizeOrder(successMessage) {
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

async function requestCheckoutOtp() {
    showToast('Order OTP verification has been removed.');
}

async function verifyCheckoutOtp(details) {
    return Boolean(details && getCheckoutOtpIdentifier(details));
}

async function processRazorpayOrder(details) {
    if (typeof Razorpay === 'undefined') {
        showToast('Razorpay failed to load. Please try again.');
        return;
    }
    if (!apiConfig.backendReady || !apiConfig.razorpayKeyId) {
        showToast('Online payment is unavailable on this deployment right now. Please use Cash on Delivery.');
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
        if (isRecoverableApiError(error.message)) {
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
            buildLocalAdminSnapshot();
            filterAdminOrders();
            await loadMyOrders();
            showToast(courierName || trackingId ? 'Shipping details saved.' : 'Shipping details cleared.');
            return;
        }
        showToast(error.message);
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
    await processRazorpayOrder(details);
}

function formatDate(value) {
    return new Date(value).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
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
            ${order.courierName ? `<div class="order-meta-line">Courier: ${order.courierName}</div>` : ''}
            ${order.trackingId ? `<div class="order-meta-line">Tracking ID: ${order.trackingId}</div>` : ''}
            <div class="order-action-row">
                <button class="order-action-btn" onclick="openOrderDocument('${order.id}','invoice', event)">Invoice</button>
                <button class="order-action-btn" onclick="openOrderDocument('${order.id}','packing-slip', event)">Packing Slip</button>
                ${order.trackingId ? `<button class="order-action-btn" onclick="openTrackingLink(${JSON.stringify(order.courierName || '')}, ${JSON.stringify(order.trackingId)})">Track Package</button>` : ''}
            </div>
            ${targetId === 'adminOrdersList' ? `<div class="order-meta-line">${order.customerName} · ${order.customerPhone} · ${order.customerEmail || ''}</div>
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
        filterAdminOrders();
        filterAdminSubscribers();
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
        filterAdminOrders();
        filterAdminSubscribers();
    } catch (error) {
        buildLocalAdminSnapshot();
        renderAdminStats();
        filterAdminOrders();
        filterAdminSubscribers();
        showToast('Admin dashboard loaded in fallback mode.');
    }
}

function renderAdminStats() {
    const summary = document.getElementById('adminStats');
    if (!summary) return;
    if (!adminStats) {
        summary.innerHTML = '';
        return;
    }
    summary.innerHTML = `
        <div class="stat-card"><span>Total Orders</span><strong>${adminStats.totalOrders}</strong></div>
        <div class="stat-card"><span>Pending</span><strong>${adminStats.pendingOrders}</strong></div>
        <div class="stat-card"><span>Shipped</span><strong>${adminStats.shippedOrders}</strong></div>
        <div class="stat-card"><span>Revenue</span><strong>₹${Number(adminStats.totalRevenue).toLocaleString()}</strong></div>
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
        if (authMode === 'signup' && String(error.message || '').toLowerCase().includes('request failed')) {
            try {
                signUpLocally(name, email, phone, password);
                completeSignedInState('Account created successfully.');
                return;
            } catch (localError) {
                showToast(localError.message);
                return;
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

async function initApp() {
    loadStoredState();
    await loadApiConfig();
    renderHomeSections();
    updateWishBadge();
    updateCartBadge();
    updateAccountUI();
    updateCouponUI();
    updateOrderSummary();
    prefillCheckout();
    renderCartItems();
    ['cName', 'cPhone', 'cEmail', 'cAddress', 'cCity', 'cPin', 'cState'].forEach(id => {
        const element = document.getElementById(id);
        if (!element) return;
        element.addEventListener('input', handleCheckoutIdentityChange);
        element.addEventListener('change', handleCheckoutIdentityChange);
    });
    updateCheckoutOtpUI();
    if (currentUser) loadMyOrders();
    initReveals();
}

initApp();
