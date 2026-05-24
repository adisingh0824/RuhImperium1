const CART_STORAGE_KEY = 'ruhImperiumCart';
const WISHLIST_STORAGE_KEY = 'ruhImperiumWishlist';
const USER_STORAGE_KEY = 'ruhImperiumUser';
const AUTH_TOKEN_KEY = 'ruhImperiumAuthToken';
const COUPON_STORAGE_KEY = 'ruhImperiumCoupon';
const ADDRESSES_STORAGE_KEY = 'ruhImperiumAddresses';
const RECENTLY_VIEWED_KEY = 'ruhImperiumRecentlyViewed';
const COMPARE_STORAGE_KEY = 'ruhImperiumCompare';
const RAZORPAY_KEY_ID = 'rzp_test_SaIRJSykISjwjQ';

const coupons = {
    BUY2: { type: 'percent', value: 20, label: 'Buy 2 Offer' },
    RAMJI20: { type: 'percent', value: 20, label: 'Ram Ji Signature Offer' },
    WELCOME10: { type: 'percent', value: 10, label: 'Welcome Offer' },
    ATTAR250: { type: 'flat', value: 250, minOrder: 1500, label: 'Flat Rs. 250 Off' },
    ADI50: { type: 'percent', value: 50, label: 'Special Offer', expiresAt: '2026-05-31T23:59:59.000Z' }
};

const ORDERS_STORAGE_KEY = 'ruhImperiumOrders';
const TRACKING_STORAGE_KEY = 'ruhImperiumLastOrder';
const TRACKING_STATUS_STEPS = [
    { label: 'Order received', detail: 'We have received your order and are preparing it at the distillery.' },
    { label: 'Preparing your attars', detail: 'The selected attars are being blended, bottled, and packed with care.' },
    { label: 'Dispatched with courier', detail: 'Your order is out for delivery with our logistics partner.' },
    { label: 'Out for delivery', detail: 'The courier partner is on the way to your address.' },
    { label: 'Delivered', detail: 'Your order has been delivered. Enjoy the fragrance!' }
];

let cart = [];
let wishlist = [];
let currentFilter = 'all';
let maxPrice = 5000;
let sortMode = 'default';
let selectedPayment = 'Razorpay';
let currentProduct = null;
let currentUser = null;
let authToken = null;
let appliedCoupon = null;
let orders = [];
let currentTrackingOrder = null;
let serverConfig = { backendReady: false, paymentEnabled: false, paymentReason: '', razorpayKeyId: '', adminEnabled: false };
let shippingProviders = [];
let selectedShippingProvider = '';
let authMode = 'login';
let authOtpState = null;
let authRecaptchaWidgetId = null;
let compareIds = [];
let lastToastMessage = '';
let lastToastAt = 0;

function loadStoredState() {
    try {
        cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
        wishlist = JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY) || '[]');
        currentUser = JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || 'null');
        authToken = localStorage.getItem(AUTH_TOKEN_KEY) || null;
        appliedCoupon = JSON.parse(localStorage.getItem(COUPON_STORAGE_KEY) || 'null');
        orders = JSON.parse(localStorage.getItem(ORDERS_STORAGE_KEY) || '[]');
        compareIds = JSON.parse(localStorage.getItem(COMPARE_STORAGE_KEY) || '[]');
    } catch (error) {
        cart = [];
        wishlist = [];
        currentUser = null;
        authToken = null;
        appliedCoupon = null;
        orders = [];
        compareIds = [];
    }
}

function persistCompare() {
    localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(compareIds.slice(0, 3)));
}

function escapeAttr(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function getCatalog() {
    if (typeof products !== 'undefined' && Array.isArray(products) && products.length) return products;
    if (Array.isArray(window.__ruhCatalog) && window.__ruhCatalog.length) return window.__ruhCatalog;
    return [];
}

function setCatalog(list) {
    const catalog = Array.isArray(list) ? list : [];
    window.__ruhCatalog = catalog;
    if (typeof products !== 'undefined' && Array.isArray(products)) {
        products.length = 0;
        products.push(...catalog);
    }
}

function assetUrl(path) {
    const value = String(path || '').trim();
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    const normalized = value.startsWith('/') ? value : `/${value}`;
    return encodeURI(normalized);
}

function formatProductTitle(product) {
    const size = product.sizes?.[0] ? ` | ${product.sizes[0]}` : '';
    return `${product.name} | ${product.cat}${size}`;
}

function scoreLocalProductMatch(product, prompt) {
    const text = String(prompt || '').toLowerCase();
    const blob = [product.name, product.cat, product.notes, product.desc, ...(product.tags || [])].join(' ').toLowerCase();
    let score = 0;
    text.split(/[^a-z0-9]+/i).filter(term => term.length > 2).forEach(term => {
        if (blob.includes(term)) score += 2;
    });
    const groups = [
        { terms: ['fresh', 'office', 'summer', 'light'], notes: ['fresh', 'summer', 'office'] },
        { terms: ['floral', 'rose', 'romantic', 'mogra'], notes: ['floral', 'rose', 'jasmine', 'mogra'] },
        { terms: ['woody', 'earthy', 'oud', 'sandal'], notes: ['woody', 'earthy', 'oud', 'sandal'] },
        { terms: ['sweet', 'vanilla', 'gourmand'], notes: ['vanilla', 'caramel', 'gourmand'] },
        { terms: ['gift', 'festival', 'set'], notes: ['gifting', 'festival', 'discovery'] },
        { terms: ['party', 'bold', 'winter'], notes: ['party', 'winter', 'musk', 'oriental'] }
    ];
    groups.forEach(group => {
        if (group.terms.some(term => text.includes(term))) {
            group.notes.forEach(note => {
                if (blob.includes(note)) score += 4;
            });
        }
    });
    if (product.bestseller) score += 1;
    return score;
}

function getLocalScentMatches(prompt, limit = 4) {
    return getCatalog()
        .map(product => ({ product, score: scoreLocalProductMatch(product, prompt) }))
        .sort((a, b) => b.score - a.score || b.product.stars - a.product.stars)
        .slice(0, limit)
        .map(entry => entry.product.name);
}

function buildLocalScentReply(message, suggestions) {
    if (!suggestions.length) {
        return 'Tell me if you want fresh, floral, woody, sweet, office, party, gifting, summer, or winter notes and I will suggest attars.';
    }
    return `For "${message}", start with ${suggestions.slice(0, 3).join(', ')}. Tap a suggestion to browse matching products.`;
}

function persistOrders() {
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
}

function saveLastOrder(order) {
    currentTrackingOrder = order;
    localStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(order));
}

function loadLastOrder() {
    try {
        currentTrackingOrder = JSON.parse(localStorage.getItem(TRACKING_STORAGE_KEY) || 'null');
    } catch (error) {
        currentTrackingOrder = null;
    }
}

function getLastOrder() {
    if (!currentTrackingOrder) loadLastOrder();
    return currentTrackingOrder;
}

function getOrderById(orderId) {
    const normalized = String(orderId || '').trim();
    if (!normalized) return null;
    const stored = getLastOrder();
    if (stored && (stored.id === normalized || stored.raw?.razorpayOrderId === normalized)) return stored;
    return orders.find(o => o.id === normalized || o.raw?.razorpayOrderId === normalized) || null;
}

function persistState() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlist));
    localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(appliedCoupon));
}

function persistUser() {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
}

function persistAuthToken() {
    if (!authToken) {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        return;
    }
    localStorage.setItem(AUTH_TOKEN_KEY, authToken);
}

function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    return headers;
}

async function fetchJson(path, options = {}) {
    const config = { headers: getAuthHeaders(), ...options };
    if (config.body && typeof config.body !== 'string') {
        config.body = JSON.stringify(config.body);
    }
    const res = await fetch(path, config);
    const text = await res.text();
    const trimmed = String(text || '').trim();
    if (!trimmed) return res.ok ? {} : { error: 'Empty response from server.' };
    if (trimmed.startsWith('<') || trimmed.startsWith('<!')) {
        return { error: res.status === 404 ? 'Service unavailable. Please refresh the page.' : 'Unexpected server response.' };
    }
    try {
        const data = JSON.parse(trimmed);
        if (!res.ok && !data.error) data.error = data.message || `Request failed (${res.status})`;
        return data;
    } catch (error) {
        return { error: trimmed.slice(0, 180) || 'Unexpected response' };
    }
}

// Try the given path and fallback to common alternatives when a 404 is returned.
async function fetchJsonWithFallback(path, options = {}) {
    const tried = [];
    const makeAlternatives = (p) => {
        const alts = [p];
        try {
            const last = p.split('/').pop();
            if (p.includes('/api/auth/')) {
                alts.push(p.replace('/api/auth/', '/api/'));
                alts.push('/' + last);
            } else if (p.includes('/api/')) {
                alts.push(p.replace('/api/', '/api/auth/'));
                alts.push('/' + last);
            } else {
                alts.push(`/api/${last}`);
                alts.push(`/api/auth/${last}`);
            }
        } catch (e) {}
        // /ensure unique and keep original order
        return Array.from(new Set(alts));
    };

    const alternatives = makeAlternatives(path);
    for (const p of alternatives) {
        tried.push(p);
        try {
            const config = { headers: getAuthHeaders(), ...options };
            if (config.body && typeof config.body !== 'string') config.body = JSON.stringify(config.body);
            const res = await fetch(p, config);
            const text = await res.text();
            if (res.status === 404) {
                // try next
                continue;
            }
            try { return { ...(JSON.parse(text || '{}')), __status: res.status }; } catch (e) { return { error: text || 'Unexpected response', __status: res.status }; }
        } catch (err) {
            // network error — stop and return helpful message
            return { error: `Network error calling ${p}: ${err.message || err}`, __failed: p };
        }
    }
    return { error: `NOT_FOUND: tried ${tried.join(', ')}`, __tried: tried };
}

function showDetailedError(response, intent) {
    try {
        console.error('API failure:', intent || '', response);
    } catch (e) {}
    const short = response && response.error ? String(response.error).split('\n')[0] : 'Request failed';
    showToast(`${short} — open console for details`);
    try { populateAuthDebug(response, intent); } catch (e) {}
}

function populateAuthDebug(response, intent) {
    const panel = document.getElementById('authDebug');
    if (!panel) return;
    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (!isLocal) return;
    const details = Object.assign({}, response || {});
    if (!details.__tried && details.__failed) details.__tried = [details.__failed];
    const payload = {
        intent: intent || '',
        time: new Date().toISOString(),
        details
    };
    panel.textContent = JSON.stringify(payload, null, 2);
    panel.style.display = 'block';
}

async function loadServerConfig() {
    try {
        const config = await fetchJson('/api/config', { method: 'GET' });
        if (!config.error) {
            serverConfig = config;
            if (config.razorpayKeyId) {
                document.getElementById('payRazorpayBtn')?.classList.remove('disabled');
            }
            // initialize reCAPTCHA if provided by server
            if (config.recaptchaSiteKey) {
                window.RUH_CONFIG = window.RUH_CONFIG || {};
                window.RUH_CONFIG.recaptchaSiteKey = config.recaptchaSiteKey;
                initRecaptcha(config.recaptchaSiteKey);
            }
            updateCheckoutPaymentUI();
        }
    } catch (error) {
        console.warn('Server config unavailable:', error.message || error);
    }
}

function initRecaptcha(siteKey) {
    if (!siteKey) return;
    // load grecaptcha script if not present
    if (!window.grecaptcha) {
        const s = document.createElement('script');
        s.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
        s.async = true;
        s.defer = true;
        s.onload = () => { renderAuthRecaptcha(siteKey); };
        document.head.appendChild(s);
        return;
    }
    renderAuthRecaptcha(siteKey);
}

function renderAuthRecaptcha(siteKey) {
    try {
        const container = document.getElementById('authRecaptcha');
        if (!container || !window.grecaptcha) return;
        container.innerHTML = '';
        authRecaptchaWidgetId = window.grecaptcha.render(container, { 'sitekey': siteKey });
        const wrapper = document.getElementById('authRecaptchaWrapper');
        if (wrapper) wrapper.style.display = 'block';
    } catch (e) { console.warn('recaptcha render failed', e); }
}

async function loadShippingProviders() {
    try {
        const data = await fetchJson('/api/shipping/providers', { method: 'GET' });
        if (Array.isArray(data.providers)) {
            shippingProviders = data.providers;
            const select = document.getElementById('cShippingProvider');
            if (select) {
                select.innerHTML = `<option value="">Choose courier</option>` + data.providers.map(provider => `<option value="${provider.id}">${provider.label}</option>`).join('');
            }
        }
    } catch (error) {
        console.warn('Shipping providers unavailable:', error.message || error);
    }
}

function normalizeServerOrder(order) {
    if (!order || typeof order !== 'object') return null;
    return {
        id: order.id,
        createdAt: order.createdAt,
        details: {
            name: order.customerName || order.details?.name || '',
            phone: order.customerPhone || order.details?.phone || '',
            email: order.customerEmail || order.details?.email || '',
            address: order.shippingAddress?.address || order.details?.address || '',
            city: order.shippingAddress?.city || order.details?.city || '',
            state: order.shippingAddress?.state || order.details?.state || '',
            pin: order.shippingAddress?.pin || order.details?.pin || ''
        },
        paymentLabel: order.paymentMethod || order.paymentLabel || 'Unknown',
        paymentId: order.razorpayPaymentId || order.paymentId || '',
        items: Array.isArray(order.items) ? order.items.map(item => ({
            id: item.id,
            name: item.name,
            img: item.img || item.image || '',
            size: item.size,
            qty: item.qty,
            price: item.unitPrice || item.price || 0
        })) : [],
        pricing: {
            subtotal: order.subtotal || order.pricing?.subtotal || 0,
            discount: order.discount || order.pricing?.discount || 0,
            delivery: order.deliveryCharge || order.pricing?.delivery || 0,
            total: order.total || order.pricing?.total || 0
        },
        coupon: order.couponCode ? { code: order.couponCode } : order.coupon,
        status: order.orderStatus || order.status || 'pending',
        courierName: order.courierName || '',
        trackingId: order.trackingId || '',
        raw: order
    };
}

async function refreshOrders() {
    if (!authToken) return;
    const response = await fetchJson('/api/orders', { method: 'GET' });
    if (!response.error && Array.isArray(response.orders)) {
        orders = response.orders.map(normalizeServerOrder);
        persistOrders();
        updateAccountUI();
    }
}

function updateCheckoutPaymentUI() {
    const note = document.getElementById('paymentStatusNote');
    if (!note) return;
    if (!serverConfig.backendReady) {
        note.textContent = 'Server integration is unavailable. Checkout will use local fallback mode.';
        return;
    }
    if (!serverConfig.paymentEnabled) {
        note.textContent = `Razorpay integration is currently unavailable: ${serverConfig.paymentReason}`;
        return;
    }
    note.textContent = 'Razorpay is ready for secure checkout. Choose the payment option that suits you.';
}

function updateAccountUI() {
    const label = document.getElementById('accountLabel');
    const initial = document.getElementById('accountInitial');
    const ordersBtn = document.getElementById('ordersBtn');
    const adminBadge = document.getElementById('accountAdminBadge');
    const topAdminBadge = document.getElementById('topAdminBadge');
    const showOrders = Boolean(currentUser) || orders.length > 0;
    if (currentUser) {
        label.textContent = currentUser.name.split(' ')[0];
        initial.textContent = currentUser.name.charAt(0).toUpperCase();
    } else {
        label.textContent = 'Account';
        initial.textContent = 'A';
    }
    if (ordersBtn) ordersBtn.style.display = showOrders ? 'inline-flex' : 'none';
    if (adminBadge) adminBadge.style.display = currentUser?.isAdmin ? 'inline-block' : 'none';
    if (topAdminBadge) topAdminBadge.style.display = currentUser?.isAdmin ? 'inline-flex' : 'none';
    renderAuthView();
    renderCartItems();
}

function getServerOrderMatching(orderId) {
    return orders.find(o => o.id === orderId) || null;
}

function renderScentMessage(text, type = 'assistant', loading = false) {
    const messages = document.getElementById('scentMessages');
    if (!messages) return;
    const bubble = document.createElement('div');
    bubble.className = `scent-message ${type}${loading ? ' loading' : ''}`;
    bubble.innerHTML = `<p>${text}</p>`;
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
}

function scrollScentMessages() {
    const messages = document.getElementById('scentMessages');
    if (messages) messages.scrollTop = messages.scrollHeight;
}

function renderScentAssistantReply(assistantBubble, message, response) {
    const suggestions = Array.isArray(response.suggestions) && response.suggestions.length
        ? response.suggestions
        : getLocalScentMatches(message);
    const reply = response.reply || buildLocalScentReply(message, suggestions);
    assistantBubble.classList.remove('loading');

    const catalog = getCatalog();
    const matchedProducts = suggestions
        .map(name => catalog.find(p => p.name === name || p.displayName === name))
        .filter(Boolean)
        .slice(0, 4);

    if (matchedProducts.length) {
        assistantBubble.innerHTML = `<p style="margin-bottom:12px;">${reply}</p>
            <div class="products-grid" style="grid-template-columns:repeat(2,1fr);gap:12px;max-width:520px;">
                ${matchedProducts.map(p => productCardHTML(p)).join('')}
            </div>`;
        assistantBubble.querySelectorAll('[data-open-id]').forEach(btn => {
            btn.addEventListener('click', () => openProductModal(Number(btn.dataset.openId)));
        });
        assistantBubble.querySelectorAll('[data-add-id]').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); quickAdd(e, Number(btn.dataset.addId)); });
        });
        assistantBubble.querySelectorAll('[data-buy-id]').forEach(btn => {
            btn.addEventListener('click', () => quickBuy(Number(btn.dataset.buyId)));
        });
        assistantBubble.querySelectorAll('[data-product-id]').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('button')) openProductModal(Number(card.dataset.productId));
            });
        });
    } else {
        assistantBubble.innerHTML = `<p>${reply}</p>
            <div class="scent-suggestions">${suggestions.map(item => `<button type="button" class="scent-suggestion-card" data-suggestion="${escapeAttr(item)}"><strong>${item}</strong><small>Tap to search</small></button>`).join('')}</div>`;
        assistantBubble.querySelectorAll('[data-suggestion]').forEach(btn => {
            btn.addEventListener('click', () => handleScentSuggestion(btn.dataset.suggestion || ''));
        });
    }
    scrollScentMessages();
}

async function sendScentMessage(event) {
    if (event) event.preventDefault();
    const input = document.getElementById('scentInput');
    if (!input) return;
    const message = input.value.trim();
    if (!message) {
        showToast('Please ask the assistant a question.');
        return;
    }
    if (!getCatalog().length) {
        showToast('Products are still loading. Please try again in a moment.');
        return;
    }
    input.value = '';
    renderScentMessage(message, 'user');
    const assistantBubble = renderScentMessage('Finding the best attar matches for you...', 'assistant', true);
    try {
        const response = await fetchJson('/api/ai-scent-chat', {
            method: 'POST',
            body: { message }
        });
        if (response.error) {
            renderScentAssistantReply(assistantBubble, message, {
                reply: buildLocalScentReply(message, getLocalScentMatches(message)),
                suggestions: getLocalScentMatches(message)
            });
            return;
        }
        renderScentAssistantReply(assistantBubble, message, response);
    } catch (error) {
        renderScentAssistantReply(assistantBubble, message, {
            reply: buildLocalScentReply(message, getLocalScentMatches(message)),
            suggestions: getLocalScentMatches(message)
        });
    }
}

function handleScentSuggestion(suggestion) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = suggestion;
        doSearch(suggestion);
        closeScentAssistant();
        openSearch();
    }
}

function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    const now = Date.now();
    if (msg === lastToastMessage && now - lastToastAt < 2200) return;
    lastToastMessage = msg;
    lastToastAt = now;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => t.classList.remove('show'), 2600);
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
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
}

function updateShopFilterUI(cat) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === cat);
    });
    document.querySelectorAll('.mobile-menu-links a[data-filter]').forEach(link => {
        link.classList.toggle('active', link.dataset.filter === cat);
    });
    const summary = document.getElementById('shopFilterSummary');
    if (!summary) return;
    summary.textContent = cat === 'all'
        ? 'Browse every attar, fragrance, and gifting set in the Ruh Imperium collection.'
        : `Showing curated ${cat} selections for your next scent discovery.`;
}

function filterShop(cat) {
    currentFilter = cat;
    document.getElementById('home-page').style.display = 'none';
    document.getElementById('shop-page').classList.add('active');
    window.scrollTo(0, 0);
    document.getElementById('shopTitle').textContent = cat === 'all' ? 'All Products' : cat;
    updateShopFilterUI(cat);
    renderShopGrid();
}

function filterByNote(note) {
    currentFilter = note;
    document.getElementById('home-page').style.display = 'none';
    document.getElementById('shop-page').classList.add('active');
    window.scrollTo(0, 0);
    document.getElementById('shopTitle').textContent = `${note} Fragrances`;
    updateShopFilterUI(note);
    renderShopGrid();
}

function shopFilter(cat, btn) {
    currentFilter = cat;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.getElementById('shopTitle').textContent = cat === 'all' ? 'All Products' : cat;
    updateShopFilterUI(cat);
    renderShopGrid();
}

function sortProducts(val) { sortMode = val; renderShopGrid(); }

function filterByPrice(val) {
    maxPrice = parseInt(val);
    document.getElementById('priceVal').textContent = '₹' + val;
    renderShopGrid();
}

function getFilteredProducts() {
    let filtered = getCatalog().filter(p => {
        if (currentFilter === 'all') return true;
        return (
            p.cat.toLowerCase().includes(currentFilter.toLowerCase()) ||
            p.notes.toLowerCase().includes(currentFilter.toLowerCase()) ||
            p.tags.some(t => t.toLowerCase().includes(currentFilter.toLowerCase()))
        );
    }).filter(p => p.price <= maxPrice);

    if (sortMode === 'price-asc')  filtered.sort((a, b) => a.price - b.price);
    if (sortMode === 'price-desc') filtered.sort((a, b) => b.price - a.price);
    if (sortMode === 'rating')     filtered.sort((a, b) => b.stars - a.stars);
    if (sortMode === 'newest')     filtered.sort((a, b) => (b.badge === 'NEW' ? 1 : 0) - (a.badge === 'NEW' ? 1 : 0));
    return filtered;
}

function starStr(s) {
    const full = Math.floor(s), half = s % 1 >= 0.5;
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - (half ? 1 : 0));
}

function productCardTitle(p) {
    if (p.displayName) return p.displayName;
    const size = p.sizes?.[0] || '';
    return size && size !== 'Standard' ? `${p.name} | ${p.cat} | ${size}` : `${p.name} | ${p.cat}`;
}

function productCardHTML(p) {
    const inWish = wishlist.includes(p.id);
    const inCompare = compareIds.includes(p.id);
    const hasOptions = (p.sizes?.length || 0) > 1;
    const mainBtn = hasOptions
        ? `<button class="add-btn-main" type="button" data-open-id="${p.id}">Choose options</button>`
        : `<button class="add-btn-main" type="button" data-add-id="${p.id}">Add to cart</button>`;
    return `
    <div class="product-card card-3d" data-product-id="${p.id}" role="button" tabindex="0">
      <div class="card-3d-inner">
      ${p.badge ? `<span class="product-badge ${p.badge === 'NEW' ? 'new' : ''}">${p.badge}</span>` : ''}
      <div class="product-img-wrap">
        <img src="${assetUrl(p.img)}" alt="${escapeAttr(p.name)}" loading="lazy" draggable="false" onerror="this.onerror=null;this.src='/ruh-imperium-logo.jpg';this.style.objectFit='contain';this.style.padding='18px';this.parentElement.style.background='#efefef'">
        <button class="wishlist-btn ${inWish ? 'active' : ''}" type="button" data-wish-id="${p.id}" aria-label="Toggle wishlist">♥</button>
      </div>
      <div class="product-info">
        <p class="product-desc">${p.cat}</p>
        <h3 class="product-name">${productCardTitle(p)}</h3>
        <p class="product-variant">${p.notes}${p.reviews ? ` · ${p.reviews} reviews` : ''}</p>
        <div class="product-stars">${starStr(p.stars)} <span>(${p.reviews} reviews)</span></div>
        <div class="product-price-row">
          <div>
            <span class="product-price">₹${p.price.toLocaleString()}</span>
            ${p.oldPrice ? `<span class="product-price-old">₹${p.oldPrice.toLocaleString()}</span>` : ''}
          </div>
          <button class="add-btn" type="button" data-add-id="${p.id}">Add to Cart</button>
        </div>
        <div class="product-actions">
          ${mainBtn}
          <button class="buy-now-btn" type="button" data-buy-id="${p.id}">Buy Now</button>
          <button class="compare-btn ${inCompare ? 'active' : ''}" type="button" data-compare-id="${p.id}">${inCompare ? 'Added' : 'Compare'}</button>
        </div>
      </div>
      </div>
    </div>`;
}

function renderShopGrid() {
    const filtered = getFilteredProducts();
    const grid = document.getElementById('shopGrid');
    document.getElementById('shopCount').textContent = filtered.length + ' products found';
    grid.innerHTML = filtered.length === 0
        ? `<div style="grid-column:1/-1;text-align:center;padding:60px;font-family:'Cormorant Garamond',serif;font-size:20px;color:var(--text-light);font-style:italic;">No products found. Try adjusting filters.</div>`
        : filtered.map(p => productCardHTML(p)).join('');
    if (window.refreshRuh3D) window.refreshRuh3D(grid);
}

function renderHomeSections() {
    const catalog = getCatalog();
    if (!catalog.length) {
        console.warn('Product data not loaded, homepage sections cannot be rendered.');
        return;
    }
    const emptyMsg = '<p class="grid-empty" style="grid-column:1/-1;text-align:center;padding:40px 20px;color:#666;font-size:14px;">Loading products…</p>';
    const fill = (id, items) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = items.length
            ? items.map(p => productCardHTML(p)).join('')
            : emptyMsg;
    };
    fill('bestsellerGrid', catalog.filter(p => p.bestseller).slice(0, 4));
    fill('newArrivalsGrid', catalog.filter(p => p.cat === 'Next Gen Fragrances').slice(0, 4));
    fill('attarsCollectionGrid', catalog.filter(p => p.cat === 'Authentic Indian Attars').slice(0, 4));
    fill('edpCollectionGrid', catalog.filter(p => p.cat === 'Eau De Parfum').slice(0, 4));
    fill('wellnessCollectionGrid', catalog.filter(p => p.cat === 'Wellness').slice(0, 4));
    renderRecommendations();
    renderRecentlyViewed();
    if (window.refreshRuh3D) {
        [
            'bestsellerGrid', 'newArrivalsGrid', 'attarsCollectionGrid', 'edpCollectionGrid',
            'wellnessCollectionGrid', 'recentlyViewedGrid'
        ].forEach(id => {
            const grid = document.getElementById(id);
            if (grid) window.refreshRuh3D(grid);
        });
    }
}

function getRecentlyViewedIds() {
    try {
        return JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]');
    } catch (error) {
        return [];
    }
}

function rememberRecentlyViewed(id) {
    const next = [id, ...getRecentlyViewedIds().filter(entry => entry !== id)].slice(0, 6);
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
    renderRecentlyViewed();
}

function renderRecentlyViewed() {
    const grid = document.getElementById('recentlyViewedGrid');
    if (!grid) return;
    const ids = getRecentlyViewedIds();
    const items = ids.map(id => getCatalog().find(p => p.id === id)).filter(Boolean);
    grid.innerHTML = items.length
        ? items.map(p => productCardHTML(p)).join('')
        : '<div class="recently-viewed-empty">Products you view will appear here for quick access.</div>';
    if (window.refreshRuh3D) window.refreshRuh3D(grid);
}

function renderRecommendations() {
    const recommendations = getCatalog()
        .filter(p => p.bestseller || p.badge === 'NEW')
        .slice(0, 5);
    const list = document.getElementById('recommendationList');
    if (!list) return;
    list.innerHTML = recommendations.map(p => `
        <button class="recommendation-card" type="button" onclick="openProductModal(${p.id})">
            <strong>${p.name}</strong>
            <span>${p.cat}</span>
            <small>₹${p.price.toLocaleString()}</small>
        </button>
    `).join('');
}

function toggleWish(e, id) {
    e.stopPropagation();
    if (wishlist.includes(id)) {
        wishlist = wishlist.filter(x => x !== id);
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
    if (wishlist.length > 0) { badge.textContent = wishlist.length; badge.style.display = 'flex'; }
    else badge.style.display = 'none';
}

function showWishlist() {
    if (wishlist.length === 0) { showToast('Your wishlist is empty'); return; }
    document.getElementById('home-page').style.display = 'none';
    document.getElementById('shop-page').classList.add('active');
    document.getElementById('shopTitle').textContent = 'My Wishlist ❤️';
    window.scrollTo(0, 0);
    const wishProducts = getCatalog().filter(p => wishlist.includes(p.id));
    document.getElementById('shopCount').textContent = wishProducts.length + ' items';
    document.getElementById('shopGrid').innerHTML = wishProducts.map(p => productCardHTML(p)).join('');
}

function quickAdd(e, id) {
    e.stopPropagation();
    const p = getCatalog().find(x => x.id === id);
    if (!p) { showToast('Product not found.'); return; }
    addToCart(p, p.sizes[0]);
}

function addToCart(p, size) {
    const existing = cart.find(x => x.id === p.id && x.size === size);
    if (existing) existing.qty++;
    else cart.push({ id: p.id, name: p.name, img: p.img, price: p.price, size, qty: 1 });
    persistState();
    updateCartBadge();
    showToast('✓ ' + p.name + ' added to cart');
    renderCartItems();
}

function updateCartBadge() {
    const count = cart.reduce((a, x) => a + x.qty, 0);
    document.getElementById('cartBadge').textContent = count;
    const mobileBadge = document.getElementById('mobileCartBadge');
    if (mobileBadge) mobileBadge.textContent = count;
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
    const el     = document.getElementById('cartItems');
    const footer = document.getElementById('cartFooter');
    const meta = document.getElementById('cartMeta');
    if (cart.length === 0) {
        el.innerHTML = '<div class="cart-empty"><span>🧴</span><p>Your cart is beautifully empty</p></div>';
        footer.style.display = 'none';
        return;
    }
    footer.style.display = 'block';
    meta.innerHTML = currentUser
        ? `Signed in as <strong>${currentUser.name}</strong>. Coupons and checkout details are ready to go.`
        : 'Sign in to save your profile and use coupons at checkout.';
    el.innerHTML = cart.map((item, i) => `
    <div class="cart-item">
      <img class="cart-item-img" src="${item.img}" alt="${item.name}" onerror="this.style.display='none'">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">₹${(item.price * item.qty).toLocaleString()} · ${item.size}</div>
        <div class="cart-qty-row">
          <button class="qty-btn" onclick="changeQty(${i},-1)">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty(${i},1)">+</button>
        </div>
      </div>
      <button class="cart-item-del" onclick="removeFromCart(${i})">🗑</button>
    </div>`).join('');
    document.getElementById('cartTotal').textContent = '₹' + getOrderPricing().total.toLocaleString();
}

function changeQty(i, delta) {
    cart[i].qty += delta;
    if (cart[i].qty <= 0) cart.splice(i, 1);
    if (appliedCoupon && !isCouponValidForCart(appliedCoupon.code, false)) {
        appliedCoupon = null;
    }
    persistState();
    updateCartBadge();
    renderCartItems();
    updateCouponUI();
    updateOrderSummary();
}

function removeFromCart(i) {
    cart.splice(i, 1);
    if (appliedCoupon && !isCouponValidForCart(appliedCoupon.code, false)) {
        appliedCoupon = null;
    }
    persistState();
    updateCartBadge();
    renderCartItems();
    updateCouponUI();
    updateOrderSummary();
}

function getCartTotal() {
    return cart.reduce((a, x) => a + x.price * x.qty, 0);
}

function getDiscountAmount(subtotal = getCartTotal()) {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.type === 'percent') return Math.round(subtotal * (appliedCoupon.value / 100));
    return Math.min(appliedCoupon.value, subtotal);
}

function getEstimatedDeliveryCharge() {
    const state = document.getElementById('cState')?.value || '';
    const pin = document.getElementById('cPin')?.value.trim() || '';
    let charge = 0;
    const remoteStates = ['West Bengal', 'Tamil Nadu', 'Karnataka', 'Maharashtra', 'Other'];
    if (remoteStates.includes(state)) charge += 99;
    if (/^[78]/.test(pin)) charge += 40;
    if (getCartTotal() >= 2499) charge = Math.max(charge - 40, 0);
    return charge;
}

function getOrderPricing() {
    const subtotal = getCartTotal();
    const discount = getDiscountAmount(subtotal);
    const delivery = getEstimatedDeliveryCharge();
    return {
        subtotal,
        discount,
        delivery,
        total: Math.max(subtotal - discount + delivery, 0)
    };
}

function isCouponValidForCart(code, showFeedback = true) {
    const normalizedCode = code.trim().toUpperCase();
    const coupon = coupons[normalizedCode];
    if (!coupon) {
        if (showFeedback) showToast('Invalid coupon code.');
        return false;
    }
    if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
        if (showFeedback) showToast('This coupon has expired.');
        return false;
    }
    if (coupon.minOrder && getCartTotal() < coupon.minOrder) {
        if (showFeedback) showToast(`Coupon works on orders above ₹${coupon.minOrder}.`);
        return false;
    }
    return true;
}

function updateCouponUI() {
    const chip = document.getElementById('couponChip');
    const chipText = document.getElementById('couponChipText');
    const couponInput = document.getElementById('couponCode');
    if (!chip || !chipText || !couponInput) return;
    if (appliedCoupon) {
        const discount = getDiscountAmount();
        chip.classList.add('show');
        chipText.textContent = `${appliedCoupon.code} applied · You save ₹${discount.toLocaleString()}`;
        couponInput.value = appliedCoupon.code;
    } else {
        chip.classList.remove('show');
        couponInput.value = '';
    }
}

function applyCoupon() {
    const code = document.getElementById('couponCode').value.trim().toUpperCase();
    if (!code) {
        showToast('Enter a coupon code first.');
        return;
    }
    if (!isCouponValidForCart(code)) return;
    const coupon = coupons[code];
    appliedCoupon = { code, ...coupon };
    persistState();
    updateCouponUI();
    renderCartItems();
    updateOrderSummary();
    showToast(`${code} applied successfully.`);
}

function removeCoupon() {
    appliedCoupon = null;
    persistState();
    updateCouponUI();
    renderCartItems();
    updateOrderSummary();
    showToast('Coupon removed.');
}

//WhatsApp Order
function whatsappOrder() {
    if (cart.length === 0) { showToast('Cart is empty!'); return; }
    const pricing = getOrderPricing();
    let msg = '🌹 *Ruh Imperium Order* 🌹\n\nI would like to order:\n\n';
    cart.forEach(item => { msg += `• ${item.name} (${item.size}) × ${item.qty} = ₹${(item.price * item.qty).toLocaleString()}\n`; });
    if (appliedCoupon) msg += `\nCoupon: ${appliedCoupon.code} (-₹${pricing.discount.toLocaleString()})\n`;
    msg += `\n*Total: ₹${pricing.total.toLocaleString()}*\n\nPlease confirm my order. Thank you!`;
    window.open('https://wa.me/919785854770?text=' + encodeURIComponent(msg), '_blank');
}

function openProductModal(id) {
    const p = getCatalog().find(x => x.id === Number(id));
    if (!p) {
        showToast('Product not found. Refresh the page and try again.');
        return;
    }
    currentProduct = p;
    rememberRecentlyViewed(p.id);

    document.getElementById('modalCat').textContent    = p.cat;
    document.getElementById('modalName').textContent   = formatProductTitle(p);
    document.getElementById('modalStars').innerHTML    = starStr(p.stars) + ` <span>(${p.reviews} reviews)</span>`;
    document.getElementById('modalPrice').textContent  = '₹' + p.price.toLocaleString();
    document.getElementById('modalOldPrice').textContent = p.oldPrice ? '₹' + p.oldPrice.toLocaleString() : '';
    document.getElementById('modalDesc').textContent   = p.desc;

    const imgWrap = document.getElementById('modalImg');
    imgWrap.innerHTML = `<img src="${assetUrl(p.img)}" alt="${escapeAttr(p.name)}" onerror="this.style.display='none';this.parentElement.style.background='var(--dark-3)'">`;
    if (p.badge) {
        const b = document.createElement('span');
        b.className = 'modal-badge' + (p.badge === 'NEW' ? ' new' : '');
        b.textContent = p.badge;
        imgWrap.appendChild(b);
    }

    let selectedSize = p.sizes[0];
    const sizeOpts = document.getElementById('sizeOpts');
    sizeOpts.innerHTML = p.sizes.map((s, i) =>
        `<button class="size-opt ${i === 0 ? 'active' : ''}" type="button" data-size-index="${i}">${s}</button>`
    ).join('');
    sizeOpts.querySelectorAll('.size-opt').forEach(btn => {
        btn.addEventListener('click', () => selectSize(btn, p.sizes[Number(btn.dataset.sizeIndex)] || p.sizes[0]));
    });

    const setModalActions = (size) => {
        selectedSize = size;
        document.getElementById('modalAddBtn').onclick = () => {
            addToCart(p, size);
            closeProductModal();
            openCart();
        };
        document.getElementById('modalBuyNowBtn').onclick = () => {
            addToCart(p, size);
            closeProductModal();
            openCheckout();
        };
        document.getElementById('modalCompareBtn').onclick = () => {
            toggleCompareProduct(p.id);
        };
        document.getElementById('modalShareBtn').onclick = () => shareProduct(p, size);
        document.getElementById('modalWaBtn').onclick = () => {
            const msg = `Hello! I am interested in *${p.name}* (${size}) at ₹${p.price.toLocaleString()}. Please help me place an order.`;
            window.open('https://wa.me/919785854770?text=' + encodeURIComponent(msg), '_blank');
        };
    };
    setModalActions(selectedSize);
    document.getElementById('modalCompareBtn').classList.toggle('active', compareIds.includes(p.id));

    document.getElementById('productModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function selectSize(btn, size) {
    document.querySelectorAll('.size-opt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (!currentProduct) return;
    document.getElementById('modalAddBtn').onclick = () => {
        addToCart(currentProduct, size);
        closeProductModal();
        openCart();
    };
    document.getElementById('modalBuyNowBtn').onclick = () => {
        addToCart(currentProduct, size);
        closeProductModal();
        openCheckout();
    };
    document.getElementById('modalWaBtn').onclick = () => {
        const msg = `Hello! I am interested in *${currentProduct.name}* (${size}) at ₹${currentProduct.price.toLocaleString()}. Please help me place an order.`;
        window.open('https://wa.me/919785854770?text=' + encodeURIComponent(msg), '_blank');
    };
}

async function shareProduct(product, size) {
    const text = `${product.name} (${size}) — ₹${product.price.toLocaleString()} at Ruh Imperium`;
    const url = `${window.location.origin}${window.location.pathname}?product=${product.id}`;
    if (navigator.share) {
        try {
            await navigator.share({ title: product.name, text, url });
            return;
        } catch (error) {
            if (error && error.name === 'AbortError') return;
        }
    }
    try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        showToast('Product link copied.');
    } catch (error) {
        showToast('Sharing is not supported on this device.');
    }
}

function quickBuy(id) {
    const p = getCatalog().find(item => item.id === id);
    if (!p) { showToast('Product not found.'); return; }
    addToCart(p, p.sizes[0]);
    openCheckout();
}

function toggleCompareProduct(id) {
    if (compareIds.includes(id)) {
        compareIds = compareIds.filter(entry => entry !== id);
        showToast('Removed from compare.');
    } else {
        if (compareIds.length >= 3) {
            showToast('You can compare up to 3 products.');
            return;
        }
        compareIds.push(id);
        showToast('Added to compare.');
    }
    persistCompare();
    updateCompareBar();
    if (document.getElementById('shop-page').classList.contains('active')) renderShopGrid();
    else renderHomeSections();
}

function updateCompareBar() {
    const bar = document.getElementById('compareBar');
    const list = document.getElementById('compareItems');
    if (!bar || !list) return;
    if (!compareIds.length) {
        bar.classList.remove('show');
        list.innerHTML = '';
        return;
    }
    bar.classList.add('show');
    list.innerHTML = compareIds.map(id => {
        const p = getCatalog().find(item => item.id === id);
        if (!p) return '';
        return `<button type="button" class="compare-pill" data-open-id="${p.id}">${p.name}</button>`;
    }).join('');
    list.querySelectorAll('[data-open-id]').forEach(btn => {
        btn.addEventListener('click', () => openProductModal(Number(btn.dataset.openId)));
    });
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('open');
    document.body.style.overflow = '';
}

function closeModal(e) {
    if (e.target === document.getElementById('productModal')) closeProductModal();
}

async function openCheckout() {
    if (cart.length === 0) { showToast('Cart is empty!'); return; }
    if (!currentUser) {
        showToast('Please sign in before checkout.');
        openAuthModal();
        return;
    }
    closeCart();
    await loadServerConfig();
    await loadShippingProviders();
    prefillCheckout();
    if (shippingProviders.length && !selectedShippingProvider) {
        selectedShippingProvider = shippingProviders[0].id;
    }
    const providerSelect = document.getElementById('cShippingProvider');
    if (providerSelect && selectedShippingProvider) providerSelect.value = selectedShippingProvider;
    updateCouponUI();
    updateOrderSummary();
    updateCheckoutPaymentUI();
    updatePinServiceability();
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
        `<div class="order-line"><span>Delivery</span><span style="color:var(--green)">₹${pricing.delivery.toLocaleString()}</span></div>` +
        `<div class="order-line"><span>Total</span><span>₹${pricing.total.toLocaleString()}</span></div>`;
}

function selectPay(btn, type) {
    selectedPayment = type;
    document.querySelectorAll('.pay-opt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const note = document.getElementById('paymentStatusNote');
    if (!note) return;
    if (type === 'COD') {
        note.textContent = 'Cash on Delivery orders are confirmed instantly and shared to WhatsApp for manual processing.';
        return;
    }
    if (!serverConfig.backendReady || !serverConfig.paymentEnabled) {
        note.textContent = 'Online payments are not ready yet. You can still place a COD order or try again later.';
        return;
    }
    note.textContent = type === 'Partial COD'
        ? 'Pay a small booking amount now and settle the balance on delivery.'
        : 'Razorpay supports UPI, cards, netbanking, and wallets for a secure checkout.';
}

function prefillCheckout() {
    if (!currentUser) return;
    document.getElementById('cName').value = currentUser.name || '';
    document.getElementById('cPhone').value = currentUser.phone || '';
    document.getElementById('cEmail').value = currentUser.email || '';
}

function getCheckoutDetails() {
    const name    = document.getElementById('cName').value.trim();
    const phone   = document.getElementById('cPhone').value.trim();
    const email   = document.getElementById('cEmail').value.trim();
    const address = document.getElementById('cAddress').value.trim();
    const city    = document.getElementById('cCity').value.trim();
    const pin     = document.getElementById('cPin').value.trim();
    const state   = document.getElementById('cState').value;
    const shippingProvider = document.getElementById('cShippingProvider')?.value || '';
    const deliveryNote = document.getElementById('cDeliveryNote')?.value.trim() || '';
    if (!name || !phone || !address || !city || !pin || !shippingProvider) { showToast('Please fill all required fields and choose a shipping option!'); return null; }
    selectedShippingProvider = shippingProvider;
    return { name, phone, email, address, city, pin, state, shippingProvider, deliveryNote };
}

function createOrder(details, paymentLabel, paymentId = '') {
    const pricing = getOrderPricing();
    const id = 'RUI' + Date.now().toString().slice(-8);
    return {
        id,
        createdAt: Date.now(),
        details,
        paymentLabel,
        paymentId,
        items: cart.map(item => ({ ...item })),
        pricing,
        coupon: appliedCoupon ? { ...appliedCoupon } : null,
        status: 'received'
    };
}

function buildOrderMessage(details, paymentLabel, paymentId = '', orderId = '') {
    const pricing = getOrderPricing();
    let msg = `🌹 *New Order - Ruh Imperium* 🌹\n\n`;
    if (orderId) msg += `*Order ID:* ${orderId}\n`;
    msg += `*Customer:* ${details.name}\n*Phone:* ${details.phone}\n`;
    if (details.email) msg += `*Email:* ${details.email}\n`;
    msg += `*Address:* ${details.address}, ${details.city}, ${details.state} - ${details.pin}\n`;
    if (details.shippingProvider) msg += `*Courier:* ${details.shippingProvider}\n`;
    if (details.deliveryNote) msg += `*Note:* ${details.deliveryNote}\n`;
    msg += `*Payment:* ${paymentLabel}\n`;
    if (paymentId) msg += `*Payment ID:* ${paymentId}\n`;
    msg += `\n*Order Details:*\n`;
    cart.forEach(item => { msg += `• ${item.name} (${item.size}) × ${item.qty} = ₹${(item.price * item.qty).toLocaleString()}\n`; });
    if (appliedCoupon) msg += `\n*Coupon:* ${appliedCoupon.code} (-₹${pricing.discount.toLocaleString()})\n`;
    msg += `\n*Total: ₹${pricing.total.toLocaleString()}*`;
    return msg;
}

function finalizeOrder(successMessage, order) {
    closeCheckout();
    if (order) {
        orders.unshift(order);
        persistOrders();
        saveLastOrder(order);
    }
    cart = [];
    appliedCoupon = null;
    persistState();
    updateCartBadge();
    renderCartItems();
    updateCouponUI();
    updateOrderSummary();
    showToast(`${successMessage}${order ? ' Order ID: ' + order.id : ''}`);
}

function launchWhatsAppOrder(details, paymentLabel, paymentId = '', orderId = '') {
    const msg = buildOrderMessage(details, paymentLabel, paymentId, orderId);
    window.open('https://wa.me/919785854770?text=' + encodeURIComponent(msg), '_blank');
}

function buildApiOrderPayload(details) {
    return {
        cart,
        couponCode: appliedCoupon?.code || '',
        customer: details,
        paymentPlan: selectedPayment === 'Partial COD' ? 'partial-cod' : 'full'
    };
}

async function processBackendCodOrder(details) {
    const response = await fetchJson('/api/orders/cod', { method: 'POST', body: buildApiOrderPayload(details) });
    if (response.error) {
        showToast(response.error || 'Unable to place the order at this time.');
        return;
    }
    await refreshOrders();
    const order = getOrderById(response.orderId);
    if (order) {
        saveLastOrder(order);
        finalizeOrder('Order placed successfully with Cash on Delivery.', order);
    } else {
        const fallback = createOrder(details, 'Cash on Delivery');
        finalizeOrder('Order placed successfully with Cash on Delivery.', fallback);
    }
}

async function processBackendRazorpayOrder(details) {
    const response = await fetchJsonWithFallback('/api/payments/razorpay/order', { method: 'POST', body: buildApiOrderPayload(details) });
    if (response.error) {
        showToast(response.error || 'Unable to initialize the payment.');
        return;
    }
    if (typeof Razorpay === 'undefined') {
        showToast('Razorpay failed to load. Please refresh the page.');
        return;
    }
    const options = {
        key: response.keyId,
        amount: response.amount,
        currency: response.currency || 'INR',
        name: 'Ruh Imperium',
        description: `Order for ${details.name}`,
        order_id: response.orderId,
        image: 'gulabattar.png',
        handler: async (paymentResponse) => {
            const verifyResponse = await fetchJsonWithFallback('/api/payments/razorpay/verify', {
                method: 'POST',
                body: {
                    orderId: paymentResponse.razorpay_order_id,
                    paymentId: paymentResponse.razorpay_payment_id,
                    signature: paymentResponse.razorpay_signature
                }
            });
            if (verifyResponse.error) {
                showToast(verifyResponse.error || 'Payment verification failed.');
                return;
            }
            await refreshOrders();
            const order = orders.find(o => o.raw?.razorpayOrderId === paymentResponse.razorpay_order_id);
            if (order) {
                saveLastOrder(order);
                finalizeOrder('Payment received successfully via Razorpay.', order);
            } else {
                const fallback = createOrder(details, 'Razorpay', paymentResponse.razorpay_payment_id);
                finalizeOrder('Payment received successfully via Razorpay.', fallback);
            }
        },
        prefill: {
            name: details.name,
            email: details.email,
            contact: details.phone
        },
        notes: {
            address: `${details.address}, ${details.city}, ${details.state} - ${details.pin}`,
            coupon: appliedCoupon?.code || 'None'
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
    const rzp = new Razorpay(options);
    rzp.open();
}

function processCodOrder(details) {
    if (serverConfig.backendReady && authToken) {
        processBackendCodOrder(details);
        return;
    }
    const order = createOrder(details, 'Cash on Delivery');
    launchWhatsAppOrder(details, 'Cash on Delivery', '', order.id);
    finalizeOrder('Order placed successfully with Cash on Delivery.', order);
}

function processRazorpayOrder(details) {
    if (serverConfig.backendReady && authToken) {
        processBackendRazorpayOrder(details);
        return;
    }
    if (typeof Razorpay === 'undefined') {
        showToast('Razorpay failed to load. Please try again.');
        return;
    }
    const clientKey = (serverConfig.razorpayKeyId && serverConfig.razorpayKeyId.length) ? serverConfig.razorpayKeyId : RAZORPAY_KEY_ID;
    if (!clientKey || clientKey.includes('replace_with_your_key')) {
        showToast('Razorpay is not configured. Add your key to the server env or client app.');
        return;
    }
    const pricing = getOrderPricing();
    const order = createOrder(details, 'Razorpay');
    const options = {
        key: clientKey,
        amount: pricing.total * 100,
        currency: 'INR',
        name: 'Ruh Imperium',
        description: `Order for ${details.name}`,
        image: 'gulabattar.png',
        handler(response) {
            launchWhatsAppOrder(details, 'Razorpay', response.razorpay_payment_id, order.id);
            order.paymentId = response.razorpay_payment_id;
            finalizeOrder('Payment received successfully via Razorpay.', order);
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
    const rzp = new Razorpay(options);
    rzp.open();
}

function placeOrder() {
    const details = getCheckoutDetails();
    if (!details) return;
    currentUser = { ...currentUser, name: details.name, email: details.email, phone: details.phone };
    persistUser();
    updateAccountUI();
    if (selectedPayment === 'COD') {
        processCodOrder(details);
        return;
    }
    processRazorpayOrder(details);
}

//SEARCH BAR OPTION
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
    const el = document.getElementById('searchResults');
    const q = String(query || '').trim().toLowerCase();
    if (!q) { el.innerHTML = ''; return; }
    const catalog = getCatalog();
    if (!catalog.length) {
        el.innerHTML = `<div class="search-empty">Products are loading. Please wait a moment.</div>`;
        return;
    }
    const results = catalog.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.cat.toLowerCase().includes(q) ||
        p.notes.toLowerCase().includes(q) ||
        p.desc.toLowerCase().includes(q) ||
        (p.tags || []).some(tag => tag.toLowerCase().includes(q))
    );
    if (results.length === 0) {
        el.innerHTML = `<div class="search-empty">No attars found. Try a different search.</div>`;
        return;
    }
    el.innerHTML = results.slice(0, 8).map(p => `
    <div class="search-result-item" data-search-id="${p.id}" role="button" tabindex="0">
      <img class="sri-img" src="${assetUrl(p.img)}" alt="${escapeAttr(p.name)}" draggable="false" onerror="this.style.display='none'">
      <div class="sri-info">
        <h4>${p.name}</h4>
        <p>${p.cat} · ₹${p.price.toLocaleString()}</p>
      </div>
    </div>`).join('');
    el.querySelectorAll('[data-search-id]').forEach(row => {
        row.addEventListener('click', () => searchSelect(Number(row.dataset.searchId)));
    });
}

function searchSelect(id) { closeSearch(); openProductModal(id); }

let deferredInstallPrompt = null;

async function subscribe() {
    const emailInput = document.getElementById('nlEmail');
    const statusEl = document.getElementById('nlStatus');
    const submitBtn = document.getElementById('nlSubmitBtn');
    const email = (emailInput?.value || '').trim().toLowerCase();

    if (!email || !email.includes('@')) {
        showToast('Please enter a valid email!');
        return;
    }

    if (submitBtn) submitBtn.disabled = true;
    if (statusEl) {
        statusEl.textContent = 'Subscribing...';
        statusEl.className = 'nl-status';
        statusEl.style.opacity = '1';
    }

    try {
        const response = await fetchJson('/api/newsletter/subscribe', {
            method: 'POST',
            body: { email }
        });

        if (response.error) {
            throw new Error(response.error);
        }

        if (emailInput) emailInput.value = '';
        const message = response.alreadySubscribed
            ? 'You are already subscribed. Thank you for staying with us!'
            : '🌸 Subscribed! Welcome to the Ruh Imperium family.';
        showToast(message);
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = 'nl-status success';
        }
    } catch (error) {
        const message = error?.message || 'Subscription failed. Please try again later.';
        showToast(message);
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = 'nl-status error';
        }
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

function handleNewsletterKeydown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        subscribe();
    }
}

function installPWA() {
    const installBtn = document.getElementById('installAppBtn');
    if (!deferredInstallPrompt) {
        showToast('Install from the browser menu or home screen options.');
        if (installBtn) installBtn.style.display = 'none';
        return;
    }

    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(choiceResult => {
        if (choiceResult.outcome === 'accepted') {
            showToast('App install prompt accepted. Thank you!');
        } else {
            showToast('Install dismissed. You can install anytime from your browser menu.');
        }
        deferredInstallPrompt = null;
        if (installBtn) installBtn.style.display = 'none';
    }).catch(() => {
        showToast('Unable to show install prompt. Please try again later.');
    });
}

function initPwaInstall() {
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) installBtn.style.display = 'none';

    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        deferredInstallPrompt = event;
        if (installBtn) {
            installBtn.style.display = 'flex';
            installBtn.setAttribute('aria-hidden', 'false');
        }
    });

    window.addEventListener('appinstalled', () => {
        showToast('Ruh Imperium is installed. Enjoy quick access!');
        if (installBtn) installBtn.style.display = 'none';
        deferredInstallPrompt = null;
    });
}

function setAuthMode(mode) {
    authMode = mode;
    authOtpState = null;
    const isSignup = mode === 'signup';
    document.getElementById('loginTab').classList.toggle('active', !isSignup);
    document.getElementById('signupTab').classList.toggle('active', isSignup);
    document.getElementById('authTitle').textContent = isSignup ? 'Create Your Account' : 'Welcome Back';
    document.getElementById('authSubtitle').textContent = isSignup
        ? 'Create a simple account on this device so checkout details and offers stay saved.'
        : 'Sign in to save your details, apply coupons faster, and move through checkout smoothly.';
    document.getElementById('authName').parentElement.style.display = isSignup ? 'block' : 'none';
    document.getElementById('authPhone').parentElement.style.display = isSignup ? 'block' : 'none';
    document.getElementById('authSubmitBtn').textContent = isSignup ? 'Create Account' : 'Sign In';
    document.getElementById('authOtpSection').style.display = 'none';
    document.getElementById('authSetPasswordSection').style.display = 'none';
    document.getElementById('authSubmitBtn').style.display = 'block';
    document.getElementById('authVerifyOtpBtn').style.display = 'none';
    const sendOtpBtn = document.getElementById('authSendOtpBtn');
    if (sendOtpBtn) sendOtpBtn.style.display = 'block';
    document.getElementById('authAltCopy').innerHTML = isSignup
        ? 'Already have an account? <a class="auth-link" onclick="setAuthMode(\'login\')">Sign in</a>'
        : 'New here? <a class="auth-link" onclick="setAuthMode(\'signup\')">Create an account</a>';
}

async function verifyAuthOtp() {
    const otpCode = (document.getElementById('authOtpCode').value || '').trim();
    if (!otpCode || otpCode.length !== 6 || !/^\d+$/.test(otpCode)) {
        showToast('Please enter a valid 6-digit code.');
        return;
    }
    // If backend is available, verify via server
    if (serverConfig.backendReady) {
        const email = (document.getElementById('authEmail').value || '').trim().toLowerCase();
        const phone = (document.getElementById('authPhone').value || '').trim();
        const response = await fetchJsonWithFallback('/api/auth/verify-otp', { method: 'POST', body: { email, phone, otp: otpCode } });
        if (response.error) {
            showDetailedError(response, '/api/auth/verify-otp');
            return;
        }
        currentUser = response.user;
        authToken = response.token || null;
        persistUser();
        persistAuthToken();
        updateAccountUI();
        prefillCheckout();
        // if server indicates user needs a password (OTP signup), show set-password UI
        if (response.needsPassword) {
            document.getElementById('authOtpSection').style.display = 'none';
            document.getElementById('authVerifyOtpBtn').style.display = 'none';
            document.getElementById('authSetPasswordSection').style.display = 'block';
            document.getElementById('authSetPassword').focus();
            return;
        }
        closeAuthModal();
        showToast('Verified successfully!');
        // clear UI
        document.getElementById('authOtpSection').style.display = 'none';
        document.getElementById('authVerifyOtpBtn').style.display = 'none';
        document.getElementById('authSubmitBtn').style.display = 'block';
        return;
    }
    // Local (testing) verification
    if (!authOtpState || authOtpState.code !== otpCode) {
        showToast('Invalid verification code. Please try again.');
        return;
    }
    currentUser = authOtpState.user;
    authToken = null;
    persistUser();
    persistAuthToken();
    updateAccountUI();
    prefillCheckout();
    closeAuthModal();
    showToast('Verified successfully!');
    authOtpState = null;
}

async function handleAuth() {
    const name = document.getElementById('authName').value.trim();
    const email = document.getElementById('authEmail').value.trim().toLowerCase();
    const phone = document.getElementById('authPhone').value.trim();
    const password = document.getElementById('authPassword').value.trim();
    if (!email || !password) {
        showToast('Email and password are required.');
        return;
    }
    if (authMode === 'signup') {
        if (!name || !phone) {
            showToast('Please complete all signup fields.');
            return;
        }
        // Signup flow
        if (serverConfig.backendReady) {
            const response = await fetchJsonWithFallback('/api/auth/signup', { method: 'POST', body: { name, email, phone, password } });
            if (response.error) {
                // If backend route is missing (deployed static site), fall back to local signup
                if (String(response.error).startsWith('NOT_FOUND') || response.__tried) {
                    currentUser = { name, email, phone, password };
                    authToken = null;
                    persistUser();
                    persistAuthToken();
                    updateAccountUI();
                    prefillCheckout();
                    closeAuthModal();
                    showToast('Account created locally on this device (backend unavailable).');
                    return;
                }
                showDetailedError(response, '/api/auth/signup');
                return;
            }
            currentUser = response.user;
            authToken = response.token || null;
            persistUser();
            persistAuthToken();
            updateAccountUI();
            prefillCheckout();
            closeAuthModal();
            showToast('Account created successfully.');
            return;
        }
        // Local signup fallback
        currentUser = { name, email, phone, password };
        authToken = null;
        persistUser();
        persistAuthToken();
        updateAccountUI();
        prefillCheckout();
        closeAuthModal();
        showToast('Account created locally on this device.');
        return;
    }
    // Login flow (password)
    if (serverConfig.backendReady) {
        const response = await fetchJsonWithFallback('/api/auth/login', { method: 'POST', body: { email, password } });
        if (response.error) {
            // If backend route missing or tried alternatives, fall back to local login
            if (String(response.error).startsWith('NOT_FOUND') || response.__tried) {
                const savedUser = JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || 'null');
                if (!savedUser || savedUser.email !== email || savedUser.password !== password) {
                    showToast('No matching account found on this device.');
                    return;
                }
                currentUser = savedUser;
                authToken = null;
                persistAuthToken();
                updateAccountUI();
                prefillCheckout();
                closeAuthModal();
                showToast('Signed in locally (backend unavailable).');
                return;
            }
            showDetailedError(response, '/api/auth/login');
            return;
        }
        currentUser = response.user;
        authToken = response.token || null;
        persistUser();
        persistAuthToken();
        updateAccountUI();
        prefillCheckout();
        closeAuthModal();
        showToast('Signed in successfully.');
        return;
    }
    // Local login fallback
    const savedUser = JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || 'null');
    if (!savedUser || savedUser.email !== email || savedUser.password !== password) {
        showToast('No matching account found on this device.');
        return;
    }
    currentUser = savedUser;
    authToken = null;
    persistAuthToken();
    updateAccountUI();
    prefillCheckout();
    closeAuthModal();
    showToast('Signed in successfully.');
}

// Send/request OTP for login; uses backend when available, else generates local OTP for testing
async function requestAuthOtp() {
    const email = (document.getElementById('authEmail').value || '').trim().toLowerCase();
    const phone = (document.getElementById('authPhone').value || '').trim();
    if (!email && !phone) {
        showToast('Enter email or phone to receive OTP.');
        return;
    }
    // collect recaptcha token if available
    let recaptchaToken = '';
    if (authRecaptchaWidgetId !== null && window.grecaptcha) {
        try { recaptchaToken = window.grecaptcha.getResponse(authRecaptchaWidgetId) || ''; } catch (e) { recaptchaToken = ''; }
    }
    if (serverConfig.backendReady) {
        if (serverConfig.health?.recaptchaConfigured && !recaptchaToken) {
            showToast('Please complete the captcha challenge before requesting OTP.');
            return;
        }
        const response = await fetchJsonWithFallback('/api/auth/request-otp', { method: 'POST', body: { email, phone, createIfMissing: authMode === 'signup', recaptcha: recaptchaToken } });
        if (response.error) {
            // If backend route missing, fall back to client-side OTP generation
            if (String(response.error).startsWith('NOT_FOUND') || response.__tried) {
                const otp = String(Math.floor(100000 + Math.random() * 900000));
                authOtpState = { user: { name: '', email, phone, password: '' }, code: otp, createdAt: Date.now() };
                document.getElementById('authOtpSection').style.display = 'block';
                document.getElementById('authVerifyOtpBtn').style.display = 'block';
                document.getElementById('authSubmitBtn').style.display = 'none';
                showToast(`OTP: ${otp} (for testing; backend unavailable)`);
                return;
            }
            showDetailedError(response, '/api/auth/request-otp');
            return;
        }
        if (response.previewOtp) {
            showToast(`OTP: ${response.previewOtp} (preview)`);
        } else {
            showToast(response.message || 'OTP sent. Check your phone.');
        }
        document.getElementById('authOtpSection').style.display = 'block';
        document.getElementById('authVerifyOtpBtn').style.display = 'block';
        document.getElementById('authSubmitBtn').style.display = 'none';
        return;
    }
    // Local OTP generation for testing
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    authOtpState = {
        user: { name: '', email, phone, password: '' },
        code: otp,
        createdAt: Date.now()
    };
    document.getElementById('authOtpSection').style.display = 'block';
    document.getElementById('authVerifyOtpBtn').style.display = 'block';
    document.getElementById('authSubmitBtn').style.display = 'none';
    showToast(`OTP: ${otp} (for testing)`);
}

function initAuthBindings() {
    const submitBtn = document.getElementById('authSubmitBtn');
    const sendBtn = document.getElementById('authSendOtpBtn');
    const verifyBtn = document.getElementById('authVerifyOtpBtn');
    const authForm = document.querySelector('.auth-form');
    if (submitBtn) {
        try { submitBtn.removeAttribute('onclick'); } catch (e) {}
        submitBtn.addEventListener('click', handleAuth);
    }
    if (sendBtn) {
        try { sendBtn.removeAttribute('onclick'); } catch (e) {}
        sendBtn.addEventListener('click', requestAuthOtp);
    }
    if (verifyBtn) {
        try { verifyBtn.removeAttribute('onclick'); } catch (e) {}
        verifyBtn.addEventListener('click', verifyAuthOtp);
    }
    const setPwdBtn = document.getElementById('authSetPasswordBtn');
    if (setPwdBtn) {
        try { setPwdBtn.removeAttribute('onclick'); } catch (e) {}
        setPwdBtn.addEventListener('click', setAuthPassword);
    }
    if (authForm) {
        authForm.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const otpSection = document.getElementById('authOtpSection');
                const otpVisible = otpSection && otpSection.style.display !== 'none';
                if (otpVisible) return verifyAuthOtp();
                if (authMode === 'login' && sendBtn && sendBtn.style.display !== 'none') return requestAuthOtp();
                return handleAuth();
            }
        });
    }
}

async function setAuthPassword() {
    const pwd = (document.getElementById('authSetPassword').value || '').trim();
    if (!pwd || pwd.length < 6) { showToast('Password must be at least 6 characters.'); return; }
    if (!serverConfig.backendReady) {
        showToast('Server not available to set password.');
        return;
    }
    const response = await fetchJsonWithFallback('/api/auth/set-password', { method: 'POST', body: { password: pwd } });
    if (response.error) {
        showDetailedError(response, '/api/auth/set-password');
        return;
    }
    showToast('Password saved. You can now sign in with email and password.');
    document.getElementById('authSetPasswordSection').style.display = 'none';
    closeAuthModal();
}

function openAuthModal() {
    renderAuthView();
    document.getElementById('authModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeAuthModal() {
    document.getElementById('authModal').classList.remove('open');
    document.body.style.overflow = '';
    try { const panel = document.getElementById('authDebug'); if (panel) panel.style.display = 'none'; } catch (e) {}
}

function renderAuthView() {
    const guestView = document.getElementById('authGuestView');
    const userView = document.getElementById('authUserView');
    if (currentUser) {
        guestView.style.display = 'none';
        userView.style.display = 'block';
        document.getElementById('accountName').textContent = currentUser.name || 'Ruh Imperium Customer';
        document.getElementById('accountEmail').textContent = currentUser.email || 'No email saved';
        document.getElementById('accountPhone').textContent = currentUser.phone || 'No phone saved';
    } else {
        guestView.style.display = 'block';
        userView.style.display = 'none';
        setAuthMode(authMode);
    }
}

// NOTE: handleAuth is implemented earlier (single source of truth).

function logout() {
    currentUser = null;
    authToken = null;
    orders = [];
    localStorage.removeItem(USER_STORAGE_KEY);
    persistAuthToken();
    persistOrders();
    updateAccountUI();
    closeAuthModal();
    showToast('You have been logged out.');
}

function getTrackingStatus(order) {
    const orderTime = order && order.createdAt ? Date.parse(order.createdAt) || Number(order.createdAt) : Date.now();
    const elapsed = Date.now() - orderTime;
    const stepIndex = Math.min(Math.floor(elapsed / 15000), TRACKING_STATUS_STEPS.length - 1);
    const step = TRACKING_STATUS_STEPS[stepIndex];
    return {
        step,
        index: stepIndex,
        progress: Math.round((stepIndex / (TRACKING_STATUS_STEPS.length - 1)) * 100)
    };
}

function renderTracking(order) {
    const result = document.getElementById('trackingResult');
    const downloadBtn = document.getElementById('downloadInvoiceBtn');
    const viewBtn = document.getElementById('viewInvoiceBtn');
    if (!result) return;
    if (!order) {
        result.innerHTML = `<p style="color:var(--text-light);font-size:14px;line-height:1.6;">No matching order found. Use your latest order ID or place a new order first.</p>`;
        if (downloadBtn) downloadBtn.disabled = true;
        if (viewBtn) viewBtn.disabled = true;
        return;
    }
    const status = getTrackingStatus(order);
    const history = TRACKING_STATUS_STEPS.map((step, index) => `
        <div class="track-step${index <= status.index ? ' active' : ''}">
            <strong>${step.label}</strong>
            <p>${step.detail}</p>
        </div>`
    ).join('');
    const trackingLink = order.trackingId ? `<p><strong>Tracking:</strong> <a href="${order.trackingId.startsWith('http') ? order.trackingId : '#'}" target="_blank">${order.trackingId}</a></p>` : '';
    const courierLine = order.courierName ? `<p><strong>Courier:</strong> ${order.courierName}</p>` : '';
    result.innerHTML = `
        <div class="track-summary">
            <p><strong>Order ID:</strong> ${order.id}</p>
            <p><strong>Total:</strong> ₹${order.pricing.total.toLocaleString()}</p>
            <p><strong>Status:</strong> ${status.step.label}</p>
            ${courierLine}
            ${trackingLink}
            <div class="track-progress"><div class="track-progress-fill" style="width:${status.progress}%"></div></div>
        </div>
        <div class="track-history">${history}</div>`;
    if (downloadBtn) downloadBtn.disabled = false;
    if (viewBtn) viewBtn.disabled = false;
    currentTrackingOrder = order;
}

function openTrackModal() {
    const modal = document.getElementById('trackModal');
    if (!modal) return;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    const order = getLastOrder();
    if (order) {
        document.getElementById('trackOrderId').value = order.id;
        renderTracking(order);
    } else {
        renderTracking(null);
    }
}

function closeTrackModal() {
    const modal = document.getElementById('trackModal');
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
    const result = document.getElementById('trackingResult');
    if (result) result.innerHTML = '';
    const field = document.getElementById('trackOrderId');
    if (field) field.value = '';
}

function trackOrder() {
    const orderId = document.getElementById('trackOrderId').value.trim();
    const order = orderId ? getOrderById(orderId) : getLastOrder();
    renderTracking(order);
    if (!order) showToast('No order matches that ID. Try your latest order or place a new order.');
}

function buildInvoiceHtml(order) {
    if (!order) return '<html><body><p>No invoice available.</p></body></html>';
    const details = order.details || {
        name: order.customerName || '',
        phone: order.customerPhone || '',
        email: order.customerEmail || '',
        address: order.shippingAddress?.address || '',
        city: order.shippingAddress?.city || '',
        state: order.shippingAddress?.state || '',
        pin: order.shippingAddress?.pin || ''
    };
    const itemsRows = order.items.map(item => {
        const unitPrice = Number(item.price || item.unitPrice || 0);
        return `
        <tr>
            <td>${item.name}</td>
            <td>${item.size}</td>
            <td>${item.qty}</td>
            <td>₹${unitPrice.toLocaleString()}</td>
            <td>₹${(unitPrice * item.qty).toLocaleString()}</td>
        </tr>`;
    }).join('');
    const couponCode = order.coupon?.code || order.raw?.couponCode || '';
    const couponLine = couponCode
        ? `<tr><td colspan="4">Coupon (${couponCode})</td><td>-₹${(order.pricing?.discount || order.discount || 0).toLocaleString()}</td></tr>`
        : '';
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Invoice ${order.id}</title><style>body{font-family:Arial,sans-serif;color:#111;background:#f7f7f7;padding:24px;} .invoice{max-width:720px;margin:auto;background:#fff;padding:24px;border-radius:18px;box-shadow:0 18px 60px rgba(0,0,0,0.08);} h1{margin:0 0 16px;font-size:24px;} table{width:100%;border-collapse:collapse;margin-top:20px;} th,td{padding:12px 10px;text-align:left;border-bottom:1px solid #e2e2e2;} th{background:#f4f4f4;} .summary{margin-top:20px;} .summary p{margin:6px 0;} .total{font-weight:700;font-size:18px;} .badge{display:inline-block;margin-top:8px;padding:6px 12px;border-radius:999px;background:#e9f8ef;color:#1f6f3c;font-size:13px;}</style></head><body><div class="invoice"><h1>Invoice</h1><p><strong>Order ID:</strong> ${order.id}</p><p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleString()}</p><p><strong>Customer:</strong> ${details.name}</p><p><strong>Phone:</strong> ${details.phone}</p><p><strong>Address:</strong> ${details.address}, ${details.city}, ${details.state} - ${details.pin}</p><div class="badge">${order.paymentLabel}</div><table><thead><tr><th>Product</th><th>Size</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${itemsRows}</tbody><tfoot>${couponLine}<tr><td colspan="4">Subtotal</td><td>₹${order.pricing.subtotal.toLocaleString()}</td></tr><tr><td colspan="4">Delivery</td><td>FREE</td></tr><tr><td colspan="4" class="total">Total</td><td class="total">₹${order.pricing.total.toLocaleString()}</td></tr></tfoot></table></div></body></html>`;
}

function downloadInvoice() {
    const order = getLastOrder();
    if (!order) { showToast('No order available for invoice.'); return; }
    const html = buildInvoiceHtml(order);
    const blob = new Blob([html], { type: 'text/html' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${order.id}-invoice.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    showToast('Invoice is downloading.');
}

function showInvoice() {
    const order = getLastOrder();
    if (!order) { showToast('No invoice available.'); return; }
    const html = buildInvoiceHtml(order);
    const win = window.open();
    if (!win) { showToast('Please allow pop-ups to view the invoice.'); return; }
    win.document.write(html);
    win.document.close();
}

function openMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    const backdrop = document.getElementById('mobileMenuBackdrop');
    if (menu) menu.classList.add('open');
    if (backdrop) backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    const backdrop = document.getElementById('mobileMenuBackdrop');
    if (menu) menu.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
    document.body.style.overflow = '';
}

function updateCurrency(value) {
    const selector = document.getElementById('currencySelector');
    const chip = document.getElementById('currencyChipBtn');
    if (selector) selector.value = value;
    if (chip) chip.textContent = value;
    showToast(`Currency set to ${value}. Prices are still shown in INR in this demo.`);
}

function cycleCurrency() {
    const selector = document.getElementById('currencySelector');
    if (!selector) return;
    const options = Array.from(selector.options).map(opt => opt.value);
    const index = options.indexOf(selector.value);
    const next = options[(index + 1) % options.length];
    updateCurrency(next);
}

function openScentAssistant() {
    const panel = document.getElementById('scentAssistantPanel');
    if (!panel) return;
    panel.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeScentAssistant() {
    const panel = document.getElementById('scentAssistantPanel');
    if (!panel) return;
    panel.classList.remove('open');
    document.body.style.overflow = '';
}

function toggleScentAssistant() {
    const panel = document.getElementById('scentAssistantPanel');
    if (!panel) return;
    if (panel.classList.contains('open')) closeScentAssistant(); else openScentAssistant();
}

async function askScentAssistantPreset(prompt) {
    const input = document.getElementById('scentInput');
    if (input) input.value = prompt;
    renderScentMessage(prompt, 'user');
    const assistantBubble = renderScentMessage('Finding the best attar matches for you...', 'assistant', true);
    try {
        const response = await fetchJson('/api/ai-scent-chat', {
            method: 'POST',
            body: { message: prompt }
        });
        if (response.error) {
            renderScentAssistantReply(assistantBubble, prompt, {
                reply: buildLocalScentReply(prompt, getLocalScentMatches(prompt)),
                suggestions: getLocalScentMatches(prompt)
            });
            return;
        }
        renderScentAssistantReply(assistantBubble, prompt, response);
    } catch (error) {
        renderScentAssistantReply(assistantBubble, prompt, {
            reply: buildLocalScentReply(prompt, getLocalScentMatches(prompt)),
            suggestions: getLocalScentMatches(prompt)
        });
    }
}

async function openOrdersModal() {
    if (authToken) await refreshOrders();
    const modal = document.getElementById('ordersModal');
    if (!modal) return;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    renderOrdersList();
}

function closeOrdersModal() {
    const modal = document.getElementById('ordersModal');
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
}

function renderOrdersList() {
    const list = document.getElementById('ordersList');
    if (!list) return;
    if (orders.length === 0) {
        list.innerHTML = '<div style="padding:24px;color:var(--text-light);font-size:14px;">No past orders yet. Place an order and come back to track it.</div>';
        return;
    }
    list.innerHTML = orders.map(order => `
        <div class="order-card">
            <div class="order-card-head">
                <div><strong>${order.id}</strong></div>
                <div>${new Date(order.createdAt).toLocaleDateString()}</div>
            </div>
            <div class="order-line"><span>${order.details.name}</span><span>₹${order.pricing.total.toLocaleString()}</span></div>
            <div class="order-line"><span>${order.paymentLabel}</span><span>${order.status}</span></div>
            <div class="order-line"><span>${order.items.length} items</span><span>${order.courierName || 'No courier yet'}</span></div>
            <button type="button" onclick="openTrackedOrder('${order.id}')">Track</button>
        </div>`).join('');
}

function openTrackedOrder(orderId) {
    closeOrdersModal();
    document.getElementById('trackOrderId').value = orderId;
    openTrackModal();
    trackOrder();
}

function subscribeStockAlert() {
    const email = document.getElementById('stockAlertEmail').value.trim();
    if (!email || !email.includes('@')) { showToast('Please enter a valid email.'); return; }
    localStorage.setItem('ruhImperiumStockAlert', JSON.stringify({ email, createdAt: Date.now() }));
    document.getElementById('stockAlertEmail').value = '';
    showToast('Stock alert saved. We will notify you when the item is back.');
}

function clearCompare() {
    compareIds = [];
    persistCompare();
    updateCompareBar();
    renderHomeSections();
    if (document.getElementById('shop-page').classList.contains('active')) renderShopGrid();
    showToast('Compare list cleared.');
}

function openCompareModal() {
    if (!compareIds.length) {
        showToast('Add up to 3 products to compare first.');
        return;
    }
    const modal = document.getElementById('compareModal');
    const grid = document.getElementById('compareGrid');
    if (!modal || !grid) return;
    const items = compareIds.map(id => getCatalog().find(p => p.id === id)).filter(Boolean);
    grid.innerHTML = items.map(p => `
        <article class="compare-card card-3d">
            <img src="${escapeAttr(p.img)}" alt="${escapeAttr(p.name)}">
            <div class="compare-card-body">
                <h3>${p.name}</h3>
                <p>${p.cat}</p>
                <p><strong>Notes:</strong> ${p.notes}</p>
                <span class="compare-price">₹${p.price.toLocaleString()}</span>
                <button type="button" class="btn-primary" data-buy-id="${p.id}">Buy Now</button>
            </div>
        </article>`).join('');
    grid.querySelectorAll('[data-buy-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            closeCompareModal();
            quickBuy(Number(btn.dataset.buyId));
        });
    });
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (window.refreshRuh3D) window.refreshRuh3D(grid);
}

function closeCompareModal(e) {
    const modal = document.getElementById('compareModal');
    if (!modal) return;
    if (!e || e.target === modal) {
        modal.classList.remove('open');
        document.body.style.overflow = '';
    }
}

function updatePinServiceability() {
    const status = document.getElementById('pinServiceabilityStatus');
    const pinInput = document.getElementById('cPin');
    if (!status || !pinInput) return;
    const pin = pinInput.value.trim();
    const state = document.getElementById('cState')?.value || '';
    if (!/^\d{6}$/.test(pin)) {
        status.textContent = 'Enter a valid 6-digit PIN to check delivery.';
        status.className = 'pin-serviceability';
        return;
    }
    const charge = getEstimatedDeliveryCharge();
    const remote = ['West Bengal', 'Tamil Nadu', 'Karnataka', 'Maharashtra', 'Other'].includes(state);
    const pinSurcharge = /^[78]/.test(pin);
    status.className = 'pin-serviceability ok';
    status.textContent = remote || pinSurcharge
        ? `Deliverable to ${pin}. Estimated extra shipping ₹${charge.toLocaleString()}.`
        : `Deliverable to ${pin}. Standard delivery charges apply.`;
}

function copyAllSubscriberEmails() { showToast('Subscriber export is disabled in this demo.'); }

function exportAdminBackup() { showToast('Export backup is disabled in this demo.'); }

function exportAdminOrdersCsv() { showToast('Order export is disabled in this demo.'); }

function exportAdminSubscribersCsv() { showToast('Subscriber export is disabled in this demo.'); }

function triggerBackupImport() { showToast('Backup import is disabled in this demo.'); }

function submitReview() { showToast('Thanks for your review. It has been noted.'); }

function initReviewProductSelect() {
    const select = document.getElementById('reviewProduct');
    if (!select) return;
    const options = getCatalog()
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(p => `<option value="${p.id}">${escapeAttr(p.name)}</option>`)
        .join('');
    select.innerHTML = `<option value="">Select product</option>${options}`;
}

function setAdminFilterPreset() { showToast('Admin filtering is not active in this version.'); }

function filterAdminOrders() { showToast('Admin search is not active in this demo.'); }

function initReveals() {
    const reveals = document.querySelectorAll('.reveal');
    if (!reveals.length) return;
    const showIfVisible = el => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight + 80 && rect.bottom > -80) {
            el.classList.add('visible');
        }
    };
    if (!('IntersectionObserver' in window)) {
        reveals.forEach(el => el.classList.add('visible'));
        return;
    }
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
    }, { threshold: 0.05, rootMargin: '0px 0px 0px 0px' });
    reveals.forEach(el => {
        showIfVisible(el);
        observer.observe(el);
    });
    window.addEventListener('load', () => reveals.forEach(showIfVisible), { once: true });
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeSearch(); closeProductModal(); closeCheckout(); closeAuthModal(); }
});

async function ensureProductCatalog() {
    if (getCatalog().length > 0) return;
    try {
        const data = await fetchJson('/api/products', { method: 'GET' });
        if (Array.isArray(data.products) && data.products.length) {
            setCatalog(data.products);
        }
    } catch (error) {
        console.warn('Product catalog API fallback failed:', error.message || error);
    }
}

function initProductGridActions() {
    document.body.addEventListener('click', event => {
        const searchRow = event.target.closest('[data-search-id]');
        if (searchRow) return;
        const card = event.target.closest('[data-product-id]');
        if (card && !event.target.closest('button')) {
            event.preventDefault();
            openProductModal(Number(card.dataset.productId));
            return;
        }
        const wishBtn = event.target.closest('[data-wish-id]');
        if (wishBtn) {
            event.stopPropagation();
            toggleWish(event, Number(wishBtn.dataset.wishId));
            return;
        }
        const openBtn = event.target.closest('[data-open-id]');
        if (openBtn) {
            event.stopPropagation();
            openProductModal(Number(openBtn.dataset.openId));
            return;
        }
        const addBtn = event.target.closest('[data-add-id]');
        if (addBtn) {
            event.stopPropagation();
            quickAdd(event, Number(addBtn.dataset.addId));
            return;
        }
        const buyBtn = event.target.closest('[data-buy-id]');
        if (buyBtn) {
            event.stopPropagation();
            quickBuy(Number(buyBtn.dataset.buyId));
            return;
        }
        const compareBtn = event.target.closest('[data-compare-id]');
        if (compareBtn) {
            event.stopPropagation();
            toggleCompareProduct(Number(compareBtn.dataset.compareId));
        }
    });
}

function initCheckoutBindings() {
    const pinInput = document.getElementById('cPin');
    const stateInput = document.getElementById('cState');
    if (pinInput) {
        pinInput.addEventListener('input', updatePinServiceability);
        pinInput.addEventListener('blur', updatePinServiceability);
    }
    if (stateInput) stateInput.addEventListener('change', updatePinServiceability);
}

function applyDeepLinkProduct() {
    const params = new URLSearchParams(window.location.search);
    const productId = Number(params.get('product'));
    if (productId) openProductModal(productId);
}

async function bootApp() {
    loadStoredState();
    loadLastOrder();
    if (!getCatalog().length && typeof products === 'undefined') {
        console.error('products.js did not load — check /products.js is deployed');
    }
    await ensureProductCatalog();
    await loadServerConfig();
    initPwaInstall();
    initProductGridActions();
    initCheckoutBindings();
    renderHomeSections();
    initReviewProductSelect();
    updateWishBadge();
    updateCartBadge();
    updateAccountUI();
    updateCouponUI();
    updateOrderSummary();
    updateCompareBar();
    prefillCheckout();
    renderCartItems();
    initReveals();
    initAuthBindings();
    if (window.initRuh3D) window.initRuh3D();
    applyDeepLinkProduct();
    filterShop('all');
}

bootApp();
