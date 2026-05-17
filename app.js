const CART_STORAGE_KEY = 'ruhImperiumCart';
const WISHLIST_STORAGE_KEY = 'ruhImperiumWishlist';
const USER_STORAGE_KEY = 'ruhImperiumUser';
const COUPON_STORAGE_KEY = 'ruhImperiumCoupon';
const CURRENCY_STORAGE_KEY = 'ruhImperiumCurrency';
const COMPARE_STORAGE_KEY = 'ruhImperiumCompare';
const RECENTLY_VIEWED_STORAGE_KEY = 'ruhImperiumRecentlyViewed';
const REVIEWS_STORAGE_KEY = 'ruhImperiumReviews';
const STOCK_ALERTS_STORAGE_KEY = 'ruhImperiumStockAlerts';
const BACKUP_VERSION = 'ruh-mobile-ai-2026-05';
const RAZORPAY_KEY_ID = 'rzp_test_replace_with_your_key';
const ADMIN_USERNAME = 'adi24';
const ADMIN_PASSWORD = 'Adi19983@';
let deferredInstallPrompt = null;
let selectedCurrency = 'INR';

const currencyConfig = {
    INR: { symbol: '₹', rate: 1, locale: 'en-IN' },
    USD: { symbol: '$', rate: 0.012, locale: 'en-US' },
    AED: { symbol: 'AED ', rate: 0.044, locale: 'en-AE' },
    EUR: { symbol: '€', rate: 0.011, locale: 'de-DE' },
    GBP: { symbol: '£', rate: 0.0095, locale: 'en-GB' }
};

const coupons = {
    RAMJI20: { type: 'percent', value: 20, label: 'Ram Ji Signature Offer' },
    WELCOME10: { type: 'percent', value: 10, label: 'Welcome Offer' },
    ATTAR250: { type: 'flat', value: 250, label: 'Flat Rs. 250 Off' }
};

let cart = [];
let wishlist = [];
let currentFilter = 'all';
let maxPrice = 5000;
let sortMode = 'default';
let selectedPayment = 'Razorpay';
let currentProduct = null;
let currentUser = null;
let appliedCoupon = null;
let authMode = 'login';
let compareProducts = [];
let recentlyViewed = [];
let customerReviews = [];
let stockAlerts = [];
let currentAdminPreset = 'all';

const baseReviews = [
    { name: 'Rajesh Kumar', product: 'Mitti Attar', rating: 5, comment: 'The Mitti Attar brought back memories of the first rain on dry earth. Absolutely pure, long-lasting and genuine.', date: 'March 18, 2026' },
    { name: 'Priya Sharma', product: 'Mogra Attar', rating: 5, comment: 'Mogra Attar smells exactly like real mogra flowers. Even a tiny amount lasts the whole day. Truly authentic!', date: 'March 15, 2026' },
    { name: 'Ananya Gupta', product: 'Traditional Discovery Set', rating: 5, comment: "The Discovery Set is the perfect way to experience Ram Ji's range. Pure and truly traditional Indian perfumery.", date: 'March 12, 2026' }
];

function detectPreferredCurrency() {
    const language = (navigator.language || '').toUpperCase();
    if (language.includes('-US')) return 'USD';
    if (language.includes('-GB')) return 'GBP';
    if (language.includes('-AE') || language.startsWith('AR')) return 'AED';
    if (language.includes('-DE') || language.includes('-FR') || language.includes('-ES') || language.includes('-IT')) return 'EUR';

    try {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        if (timeZone.includes('Dubai')) return 'AED';
        if (timeZone.includes('London')) return 'GBP';
        if (timeZone.includes('Berlin') || timeZone.includes('Paris') || timeZone.includes('Rome') || timeZone.includes('Madrid')) return 'EUR';
        if (timeZone.includes('New_York') || timeZone.includes('Chicago') || timeZone.includes('Los_Angeles')) return 'USD';
    } catch (error) {}

    return 'INR';
}

function getCurrencyConfig(code = selectedCurrency) {
    return currencyConfig[code] || currencyConfig.INR;
}

function convertAmount(amount, code = selectedCurrency) {
    const config = getCurrencyConfig(code);
    return Math.round(amount * config.rate * 100) / 100;
}

function formatMoney(amount, code = selectedCurrency) {
    const config = getCurrencyConfig(code);
    const converted = convertAmount(amount, code);
    const maximumFractionDigits = code === 'INR' ? 0 : 2;
    if (code === 'AED') {
        return `AED ${converted.toLocaleString(config.locale, { minimumFractionDigits: 0, maximumFractionDigits })}`;
    }
    return `${config.symbol}${converted.toLocaleString(config.locale, { minimumFractionDigits: 0, maximumFractionDigits })}`;
}

function updateCurrency(code, persist = true) {
    selectedCurrency = currencyConfig[code] ? code : 'INR';
    const selector = document.getElementById('currencySelector');
    const mobileSelector = document.getElementById('mobileCurrencySelector');
    const chipBtn = document.getElementById('currencyChipBtn');
    if (selector) selector.value = selectedCurrency;
    if (mobileSelector) mobileSelector.value = selectedCurrency;
    if (chipBtn) chipBtn.textContent = selectedCurrency;
    if (persist) {
        localStorage.setItem(CURRENCY_STORAGE_KEY, selectedCurrency);
    }
    const priceVal = document.getElementById('priceVal');
    if (priceVal) priceVal.textContent = formatMoney(maxPrice);
    renderHomeSections();
    if (document.getElementById('shop-page')?.classList.contains('active')) renderShopGrid();
    if (document.getElementById('cartItems')) renderCartItems();
    updateCouponUI();
    updateOrderSummary();
}

function cycleCurrency() {
    const codes = Object.keys(currencyConfig);
    const currentIndex = codes.indexOf(selectedCurrency);
    const nextCode = codes[(currentIndex + 1) % codes.length];
    updateCurrency(nextCode);
    showToast(`Currency changed to ${nextCode}`);
}

function loadStoredState() {
    try {
        cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
        wishlist = JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY) || '[]');
        currentUser = JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || 'null');
        appliedCoupon = JSON.parse(localStorage.getItem(COUPON_STORAGE_KEY) || 'null');
        selectedCurrency = localStorage.getItem(CURRENCY_STORAGE_KEY) || detectPreferredCurrency();
        compareProducts = JSON.parse(localStorage.getItem(COMPARE_STORAGE_KEY) || '[]');
        recentlyViewed = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY) || '[]');
        customerReviews = JSON.parse(localStorage.getItem(REVIEWS_STORAGE_KEY) || '[]');
        stockAlerts = JSON.parse(localStorage.getItem(STOCK_ALERTS_STORAGE_KEY) || '[]');
    } catch (error) {
        cart = [];
        wishlist = [];
        currentUser = null;
        appliedCoupon = null;
        selectedCurrency = detectPreferredCurrency();
        compareProducts = [];
        recentlyViewed = [];
        customerReviews = [];
        stockAlerts = [];
    }
}

function persistState() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlist));
    localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(appliedCoupon));
    localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(compareProducts));
    localStorage.setItem(RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify(recentlyViewed));
    localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(customerReviews));
    localStorage.setItem(STOCK_ALERTS_STORAGE_KEY, JSON.stringify(stockAlerts));
}

function persistUser() {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
}

function escapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function debounce(fn, wait = 250) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), wait);
    };
}

function isAdminUser(user) {
    return !!(user && user.isAdmin);
}

function isAdminCredentials(identifier, password) {
    return identifier.trim().toLowerCase() === ADMIN_USERNAME.toLowerCase() && password === ADMIN_PASSWORD;
}

function setInstallButtonVisibility(shouldShow) {
    const btn = document.getElementById('installAppBtn');
    if (!btn) return;
    btn.classList.toggle('show', !!shouldShow);
}

function isStandaloneMode() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function installPWA() {
    if (!deferredInstallPrompt) {
        if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !isStandaloneMode()) {
            showToast('On iPhone, tap Share and then Add to Home Screen.');
            return;
        }
        showToast('Install prompt is not available yet. Open the site once more after deploy.');
        return;
    }

    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.finally(() => {
        deferredInstallPrompt = null;
        setInstallButtonVisibility(false);
    });
}

function showHome() {
    document.getElementById('home-page').style.display = 'block';
    document.getElementById('shop-page').classList.remove('active');
    window.scrollTo(0, 0);
    initReveals();
}

function openMobileMenu() {
    document.getElementById('mobileMenu')?.classList.add('open');
    document.getElementById('mobileMenuBackdrop')?.classList.add('open');
}

function closeMobileMenu() {
    document.getElementById('mobileMenu')?.classList.remove('open');
    document.getElementById('mobileMenuBackdrop')?.classList.remove('open');
}

function goSection(id) {
    showHome();
    setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
}

function filterShop(cat) {
    currentFilter = cat;
    document.getElementById('home-page').style.display = 'none';
    document.getElementById('shop-page').classList.add('active');
    window.scrollTo(0, 0);
    document.getElementById('shopTitle').textContent = cat === 'all' ? 'All Products' : cat;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    renderShopGrid();
}

function shopFilter(cat, btn) {
    currentFilter = cat;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.getElementById('shopTitle').textContent = cat === 'all' ? 'All Products' : cat;
    renderShopGrid();
}

function sortProducts(val) { sortMode = val; renderShopGrid(); }

function filterByPrice(val) {
    maxPrice = parseInt(val);
    document.getElementById('priceVal').textContent = formatMoney(val);
    renderShopGrid();
}

function getFilteredProducts() {
    let filtered = products.filter(p => {
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

function productCardHTML(p) {
    const inWish = wishlist.includes(p.id);
    const inCompare = compareProducts.includes(p.id);
    return `
    <div class="product-card" onclick="openProductModal(${p.id})">
      ${p.badge ? `<span class="product-badge ${p.badge === 'NEW' ? 'new' : ''}">${p.badge}</span>` : ''}
      <div class="product-img-wrap">
        <img src="${p.img}" alt="${p.name}" onerror="this.style.display='none';this.parentElement.style.background='var(--dark-3)'">
        <button class="wishlist-btn ${inWish ? 'active' : ''}" onclick="toggleWish(event,${p.id})">♥</button>
      </div>
      <div class="product-info">
        <p class="product-desc">${p.cat}</p>
        <h3 class="product-name">${p.name}</h3>
        <div class="product-stars">${starStr(p.stars)} <span>(${p.reviews} reviews)</span></div>
        <div class="product-price-row">
          <div>
            <span class="product-price">${formatMoney(p.price)}</span>
            ${p.oldPrice ? `<span class="product-price-old">${formatMoney(p.oldPrice)}</span>` : ''}
          </div>
        </div>
        <div class="product-actions">
          <button class="add-btn" onclick="quickAdd(event,${p.id})">Add to Cart</button>
          <button class="buy-now-btn" onclick="quickBuy(event,${p.id})">Buy Now</button>
          <button class="compare-btn ${inCompare ? 'active' : ''}" onclick="toggleCompare(event,${p.id})">Compare</button>
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
}

function renderHomeSections() {
    const bestsellers = products.filter(p => p.bestseller).slice(0, 4);
    const bestsellerGrid = document.getElementById('bestsellerGrid');
    if (bestsellerGrid) bestsellerGrid.innerHTML = bestsellers.map(p => productCardHTML(p)).join('');
    const newArrivals = products.filter(p => p.cat === 'Next Gen Fragrances').slice(0, 4);
    const newArrivalsGrid = document.getElementById('newArrivalsGrid');
    if (newArrivalsGrid) newArrivalsGrid.innerHTML = newArrivals.map(p => productCardHTML(p)).join('');
    const wellnessGrid = document.getElementById('wellnessGrid');
    if (wellnessGrid) {
        const wellness = products.filter(p =>
            p.notes === 'Fresh' || p.notes === 'Woody' || p.tags.includes('Daily') || p.tags.includes('Office') || p.tags.includes('Summer')
        ).slice(0, 4);
        wellnessGrid.innerHTML = wellness.map(p => productCardHTML(p)).join('');
    }
    const poojaGrid = document.getElementById('poojaGrid');
    if (poojaGrid) {
        const pooja = products.filter(p =>
            p.cat.includes('Authentic') || p.tags.includes('Festival') || ['Rose', 'Mogra', 'Sandalwood', 'Kewra', 'Hina'].some(term => p.name.includes(term))
        ).slice(0, 4);
        poojaGrid.innerHTML = pooja.map(p => productCardHTML(p)).join('');
    }
    const giftingGrid = document.getElementById('giftingGrid');
    if (giftingGrid) {
        const gifting = products.filter(p => p.tags.includes('Gifting') || p.tags.includes('Festival') || p.cat === 'Discovery Set').slice(0, 4);
        giftingGrid.innerHTML = gifting.map(p => productCardHTML(p)).join('');
    }
    renderRecentlyViewed();
}

function addRecentlyViewed(id) {
    recentlyViewed = [id, ...recentlyViewed.filter(itemId => itemId !== id)].slice(0, 8);
    persistState();
    renderRecentlyViewed();
}

function renderRecentlyViewed() {
    const grid = document.getElementById('recentlyViewedGrid');
    if (!grid) return;
    const viewedProducts = recentlyViewed.map(id => products.find(p => p.id === id)).filter(Boolean).slice(0, 4);
    if (!viewedProducts.length) {
        grid.innerHTML = '<div class="recently-viewed-empty">Products you open will appear here for quicker mobile browsing.</div>';
        return;
    }
    grid.innerHTML = viewedProducts.map(p => productCardHTML(p)).join('');
}

function getRelatedProducts(product, limit = 4) {
    if (!product) return [];
    const related = products
        .filter(p => p.id !== product.id)
        .map(p => {
            let score = 0;
            if (p.cat === product.cat) score += 4;
            if (p.notes === product.notes) score += 4;
            (p.tags || []).forEach(tag => {
                if ((product.tags || []).includes(tag)) score += 2;
            });
            if (p.bestseller) score += 1;
            return { product: p, score };
        })
        .sort((a, b) => b.score - a.score || b.product.stars - a.product.stars);
    return related.slice(0, limit).map(entry => entry.product);
}

function renderRecommendations(product) {
    const list = document.getElementById('recommendationList');
    if (!list) return;
    const related = getRelatedProducts(product, 4);
    list.innerHTML = related.map(item =>
        `<button class="recommendation-pill" type="button" onclick="openProductModal(${item.id})">${escapeHTML(item.name)}</button>`
    ).join('');
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
    const wishProducts = products.filter(p => wishlist.includes(p.id));
    document.getElementById('shopCount').textContent = wishProducts.length + ' items';
    document.getElementById('shopGrid').innerHTML = wishProducts.map(p => productCardHTML(p)).join('');
}

function quickAdd(e, id) {
    e.stopPropagation();
    const p = products.find(x => x.id === id);
    addToCart(p, p.sizes[0]);
}

function quickBuy(e, id) {
    e.stopPropagation();
    const p = products.find(x => x.id === id);
    if (!p) return;
    addToCart(p, p.sizes[0]);
    openCheckout();
}

function toggleCompare(e, id) {
    if (e) e.stopPropagation();
    if (compareProducts.includes(id)) {
        compareProducts = compareProducts.filter(x => x !== id);
        showToast('Removed from compare');
    } else {
        if (compareProducts.length >= 3) {
            showToast('You can compare up to 3 products.');
            return;
        }
        compareProducts.push(id);
        showToast('Added to compare');
    }
    persistState();
    renderCompareBar();
    renderHomeSections();
    if (document.getElementById('shop-page').classList.contains('active')) renderShopGrid();
    if (currentProduct && document.getElementById('modalCompareBtn')) {
        document.getElementById('modalCompareBtn').classList.toggle('active', compareProducts.includes(currentProduct.id));
    }
}

function renderCompareBar() {
    const bar = document.getElementById('compareBar');
    const items = document.getElementById('compareItems');
    if (!bar || !items) return;
    if (!compareProducts.length) {
        bar.classList.remove('show');
        items.innerHTML = '';
        return;
    }
    const compared = compareProducts.map(id => products.find(p => p.id === id)).filter(Boolean);
    items.innerHTML = compared.map(p => `<span class="compare-pill">${p.name}</span>`).join('');
    bar.classList.add('show');
}

function clearCompare() {
    compareProducts = [];
    persistState();
    renderCompareBar();
    renderHomeSections();
    if (document.getElementById('shop-page').classList.contains('active')) renderShopGrid();
    closeCompareModal();
}

function openCompareModal() {
    if (compareProducts.length < 2) {
        showToast('Select at least 2 products to compare.');
        return;
    }
    const grid = document.getElementById('compareGrid');
    const compared = compareProducts.map(id => products.find(p => p.id === id)).filter(Boolean);
    grid.innerHTML = compared.map(p => `
        <div class="compare-card">
            <img src="${p.img}" alt="${p.name}" onerror="this.style.display='none'">
            <div class="compare-card-body">
                <h3>${p.name}</h3>
                <span class="compare-price">${formatMoney(p.price)}</span>
                <p>${p.desc}</p>
                <div class="compare-meta">
                    Category: ${p.cat}<br>
                    Rating: ${p.stars} / 5<br>
                    Sizes: ${p.sizes.join(', ')}<br>
                    Notes: ${p.notes}
                </div>
            </div>
        </div>
    `).join('');
    document.getElementById('compareModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeCompareModal(event) {
    if (event && event.target !== document.getElementById('compareModal')) return;
    document.getElementById('compareModal').classList.remove('open');
    document.body.style.overflow = '';
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
    const cartBadge = document.getElementById('cartBadge');
    const mobileCartBadge = document.getElementById('mobileCartBadge');
    if (cartBadge) cartBadge.textContent = count;
    if (mobileCartBadge) mobileCartBadge.textContent = count;
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
        <div class="cart-item-price">${formatMoney(item.price * item.qty)} · ${item.size}</div>
        <div class="cart-qty-row">
          <button class="qty-btn" onclick="changeQty(${i},-1)">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty(${i},1)">+</button>
        </div>
      </div>
      <button class="cart-item-del" onclick="removeFromCart(${i})">🗑</button>
    </div>`).join('');
    document.getElementById('cartTotal').textContent = formatMoney(getOrderPricing().total);
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

function getCheckoutCustomerSnapshot() {
    const stateEl = document.getElementById('cState');
    const pinEl = document.getElementById('cPin');
    return {
        state: stateEl ? stateEl.value : '',
        pin: pinEl ? pinEl.value.trim() : ''
    };
}

function getDeliveryCharge(subtotal = getCartTotal()) {
    const { state, pin } = getCheckoutCustomerSnapshot();
    if (!state && !pin) return 0;
    let charge = 0;
    if (['West Bengal', 'Tamil Nadu', 'Karnataka', 'Maharashtra', 'Other'].includes(state)) charge += 99;
    if (/^[78]/.test(pin)) charge += 40;
    if (subtotal >= 2499) charge = Math.max(charge - 40, 0);
    return charge;
}

function getDiscountAmount(subtotal = getCartTotal()) {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.type === 'percent') return Math.round(subtotal * (appliedCoupon.value / 100));
    return Math.min(appliedCoupon.value, subtotal);
}

function getOrderPricing() {
    const subtotal = getCartTotal();
    const discount = getDiscountAmount(subtotal);
    const delivery = getDeliveryCharge(Math.max(subtotal - discount, 0));
    return {
        subtotal,
        discount,
        delivery,
        total: Math.max(subtotal - discount, 0) + delivery
    };
}

function isCouponValidForCart(code, showFeedback = true) {
    const normalizedCode = code.trim().toUpperCase();
    const coupon = coupons[normalizedCode];
    if (!coupon) {
        if (showFeedback) showToast('Invalid coupon code.');
        return false;
    }
    if (coupon.minOrder && getCartTotal() < coupon.minOrder) {
        if (showFeedback) showToast(`Coupon works on orders above ${formatMoney(coupon.minOrder)}.`);
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
        chipText.textContent = `${appliedCoupon.code} applied · You save ${formatMoney(discount)}`;
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
    cart.forEach(item => { msg += `• ${item.name} (${item.size}) × ${item.qty} = ${formatMoney(item.price * item.qty)}\n`; });
    if (appliedCoupon) msg += `\nCoupon: ${appliedCoupon.code} (-${formatMoney(pricing.discount)})\n`;
    if (pricing.delivery) msg += `Delivery: ${formatMoney(pricing.delivery)}\n`;
    msg += `\n*Total: ${formatMoney(pricing.total)}*\n\nPlease confirm my order. Thank you!`;
    window.open('https://wa.me/919785854770?text=' + encodeURIComponent(msg), '_blank');
}

function openProductModal(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    currentProduct = p;
    addRecentlyViewed(p.id);
    renderRecommendations(p);

    document.getElementById('modalCat').textContent    = p.cat;
    document.getElementById('modalName').textContent   = p.name;
    document.getElementById('modalStars').innerHTML    = starStr(p.stars) + ` <span>(${p.reviews} reviews)</span>`;
    document.getElementById('modalPrice').textContent  = formatMoney(p.price);
    document.getElementById('modalOldPrice').textContent = p.oldPrice ? formatMoney(p.oldPrice) : '';
    document.getElementById('modalDesc').textContent   = p.desc;

    const imgWrap = document.getElementById('modalImg');
    imgWrap.innerHTML = `<img src="${p.img}" alt="${p.name}" onerror="this.style.display='none';this.parentElement.style.background='var(--dark-3)'">`;
    if (p.badge) {
        const b = document.createElement('span');
        b.className = 'modal-badge' + (p.badge === 'NEW' ? ' new' : '');
        b.textContent = p.badge;
        imgWrap.appendChild(b);
    }

    let selectedSize = p.sizes[0];
    document.getElementById('sizeOpts').innerHTML = p.sizes.map((s, i) =>
        `<button class="size-opt ${i === 0 ? 'active' : ''}" onclick="selectSize(this,'${s}')">${s}</button>`
    ).join('');

    const setAddBtn = (size) => {
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
    };
    setAddBtn(selectedSize);
    document.getElementById('modalCompareBtn').classList.toggle('active', compareProducts.includes(p.id));
    document.getElementById('modalCompareBtn').onclick = () => toggleCompare(null, p.id);

    document.getElementById('modalWaBtn').onclick = () => {
        const msg = `Hello! I am interested in *${p.name}* (${selectedSize}) at ${formatMoney(p.price)}. Please help me place an order.`;
        window.open('https://wa.me/919785854770?text=' + encodeURIComponent(msg), '_blank');
    };
    document.getElementById('modalShareBtn').onclick = () => shareProduct(p);

    document.getElementById('productModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function selectSize(btn, size) {
    document.querySelectorAll('.size-opt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (currentProduct) {
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
            const msg = `Hello! I am interested in *${currentProduct.name}* (${size}) at ${formatMoney(currentProduct.price)}. Please help me place an order.`;
            window.open('https://wa.me/919785854770?text=' + encodeURIComponent(msg), '_blank');
        };
    }
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('open');
    document.body.style.overflow = '';
}

function closeModal(e) {
    if (e.target === document.getElementById('productModal')) closeProductModal();
}

async function shareProduct(product) {
    const url = `${window.location.origin}${window.location.pathname}?product=${product.id}`;
    const shareData = {
        title: `${product.name} | Ruh Imperium`,
        text: `${product.name} - ${product.notes} ${product.cat} at ${formatMoney(product.price)}`,
        url
    };
    if (navigator.share) {
        try {
            await navigator.share(shareData);
            return;
        } catch (error) {}
    }
    if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        showToast('Product link copied.');
    } else {
        showToast('Share link: ' + url);
    }
}

function subscribeStockAlert() {
    const emailInput = document.getElementById('stockAlertEmail');
    const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
    if (!currentProduct) {
        showToast('Open a product first.');
        return;
    }
    if (!email || !email.includes('@')) {
        showToast('Enter a valid email for stock alerts.');
        return;
    }
    const existing = stockAlerts.find(alert => alert.email === email && alert.productId === currentProduct.id);
    if (!existing) {
        stockAlerts.push({
            id: Date.now().toString(36),
            email,
            productId: currentProduct.id,
            productName: currentProduct.name,
            createdAt: new Date().toISOString()
        });
        persistState();
    }
    if (emailInput) emailInput.value = '';
    showToast('Stock alert saved.');
}

function openCheckout() {
    if (cart.length === 0) { showToast('Cart is empty!'); return; }
    if (!currentUser) {
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
        ? `<div class="order-line"><span>Coupon (${appliedCoupon.code})</span><span>-${formatMoney(pricing.discount)}</span></div>`
        : '';
    summary.innerHTML = '<h3>Order Summary</h3>' +
        cart.map(item =>
            `<div class="order-line"><span>${item.name} (${item.size}) × ${item.qty}</span><span>${formatMoney(item.price * item.qty)}</span></div>`
        ).join('') +
        `<div class="order-line"><span>Subtotal</span><span>${formatMoney(pricing.subtotal)}</span></div>` +
        couponLine +
        `<div class="order-line"><span>Delivery</span><span style="color:${pricing.delivery ? 'var(--gold-light)' : 'var(--green)'}">${pricing.delivery ? formatMoney(pricing.delivery) : 'FREE'}</span></div>` +
        `<div class="order-line"><span>Total</span><span>${formatMoney(pricing.total)}</span></div>`;
}

function selectPay(btn, type) {
    selectedPayment = type;
    document.querySelectorAll('.pay-opt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const note = document.getElementById('paymentStatusNote');
    if (note) {
        note.className = 'payment-status-note';
        if (type === 'COD') {
            note.textContent = 'Cash on Delivery orders are confirmed on WhatsApp after checkout.';
        } else if (type === 'Partial COD') {
            note.textContent = 'Partial COD collects a small prepaid confirmation amount, then the balance on delivery.';
        } else {
            note.textContent = 'Razorpay supports UPI, cards, netbanking, and wallets. Add live keys before taking payments.';
        }
    }
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
    if (!name || !phone || !address || !city || !pin) { showToast('Please fill all required fields!'); return null; }
    return { name, phone, email, address, city, pin, state };
}

function buildOrderMessage(details, paymentLabel, paymentId = '') {
    const pricing = getOrderPricing();
    let msg = `🌹 *New Order - Ruh Imperium* 🌹\n\n`;
    msg += `*Customer:* ${details.name}\n*Phone:* ${details.phone}\n`;
    if (details.email) msg += `*Email:* ${details.email}\n`;
    msg += `*Address:* ${details.address}, ${details.city}, ${details.state} - ${details.pin}\n`;
    msg += `*Payment:* ${paymentLabel}\n`;
    if (paymentId) msg += `*Payment ID:* ${paymentId}\n`;
    msg += `\n*Order Details:*\n`;
    cart.forEach(item => { msg += `• ${item.name} (${item.size}) × ${item.qty} = ${formatMoney(item.price * item.qty)}\n`; });
    if (appliedCoupon) msg += `\n*Coupon:* ${appliedCoupon.code} (-${formatMoney(pricing.discount)})\n`;
    if (pricing.delivery) msg += `*Delivery:* ${formatMoney(pricing.delivery)}\n`;
    msg += `\n*Total: ${formatMoney(pricing.total)}*`;
    return msg;
}

function finalizeOrder(successMessage) {
    closeCheckout();
    cart = [];
    appliedCoupon = null;
    persistState();
    updateCartBadge();
    renderCartItems();
    updateCouponUI();
    updateOrderSummary();
    showToast(successMessage);
}

function launchWhatsAppOrder(details, paymentLabel, paymentId = '') {
    const msg = buildOrderMessage(details, paymentLabel, paymentId);
    window.open('https://wa.me/919785854770?text=' + encodeURIComponent(msg), '_blank');
}

function processCodOrder(details) {
    launchWhatsAppOrder(details, 'Cash on Delivery');
    finalizeOrder('Order placed successfully with Cash on Delivery.');
}

function processRazorpayOrder(details) {
    if (typeof Razorpay === 'undefined') {
        showToast('Razorpay failed to load. Please try again.');
        return;
    }
    if (!RAZORPAY_KEY_ID || RAZORPAY_KEY_ID.includes('replace_with_your_key')) {
        showToast('Add your Razorpay key in app.js before using online payments.');
        return;
    }
    const pricing = getOrderPricing();
    const payableNow = selectedPayment === 'Partial COD' ? Math.max(1, Math.round(pricing.total * 0.2)) : pricing.total;
    const options = {
        key: RAZORPAY_KEY_ID,
        amount: payableNow * 100,
        currency: 'INR',
        name: 'Ruh Imperium',
        description: selectedPayment === 'Partial COD' ? `20% confirmation for ${details.name}` : `Order for ${details.name}`,
        image: 'gulabattar.png',
        handler(response) {
            launchWhatsAppOrder(details, selectedPayment === 'Partial COD' ? 'Partial COD deposit via Razorpay' : 'Razorpay', response.razorpay_payment_id);
            finalizeOrder(selectedPayment === 'Partial COD' ? 'Partial COD deposit received successfully.' : 'Payment received successfully via Razorpay.');
        },
        prefill: {
            name: details.name,
            email: details.email,
            contact: details.phone
        },
        notes: {
            address: `${details.address}, ${details.city}, ${details.state} - ${details.pin}`,
            coupon: appliedCoupon ? appliedCoupon.code : 'None',
            payableNow,
            orderTotal: pricing.total
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
    if (!query.trim()) { el.innerHTML = ''; return; }
    const results = products.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.cat.toLowerCase().includes(query.toLowerCase()) ||
        p.notes.toLowerCase().includes(query.toLowerCase()) ||
        p.desc.toLowerCase().includes(query.toLowerCase())
    );
    if (results.length === 0) {
        el.innerHTML = `<div style="color:rgba(253,246,232,0.4);font-family:'Cormorant Garamond',serif;font-size:18px;font-style:italic;padding:20px 0;">No attars found. Try a different search.</div>`;
        return;
    }
    el.innerHTML = results.slice(0, 6).map(p => `
    <div class="search-result-item" onclick="searchSelect(${p.id})">
      <img class="sri-img" src="${p.img}" alt="${p.name}" onerror="this.style.display='none'">
      <div class="sri-info">
        <h4>${p.name}</h4>
        <p>${p.cat} · ${formatMoney(p.price)}</p>
      </div>
    </div>`).join('');
}

function searchSelect(id) { closeSearch(); openProductModal(id); }

async function subscribe() {
    const emailInput = document.getElementById('nlEmail');
    const status = document.getElementById('nlStatus');
    const btn = document.getElementById('nlSubmitBtn');
    const email = emailInput.value.trim().toLowerCase();
    if (!email || !email.includes('@')) {
        showToast('Please enter a valid email.');
        return;
    }
    if (btn) btn.disabled = true;
    if (status) {
        status.className = 'nl-status';
        status.textContent = 'Saving your subscription...';
    }
    try {
        const response = await fetch('/api/newsletter/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Unable to subscribe right now.');
        emailInput.value = '';
        if (status) {
            status.className = 'nl-status success';
            status.textContent = data.alreadySubscribed ? 'You are already on the list.' : 'Subscribed. Welcome to Ruh Imperium.';
        }
        showToast('Subscribed successfully.');
    } catch (error) {
        if (status) {
            status.className = 'nl-status error';
            status.textContent = error.message || 'Subscription failed. Please try WhatsApp.';
        }
        showToast('Subscription could not be saved.');
    } finally {
        if (btn) btn.disabled = false;
    }
}

function handleNewsletterKeydown(event) {
    if (event.key === 'Enter') subscribe();
}

function setAuthMode(mode) {
    authMode = mode;
    const isSignup = mode === 'signup';
    const isAdmin = mode === 'admin';
    document.getElementById('loginTab').classList.toggle('active', !isSignup);
    document.getElementById('signupTab').classList.toggle('active', isSignup);
    document.getElementById('authTitle').textContent = isAdmin ? 'Admin Login' : isSignup ? 'Create Your Account' : 'Welcome Back';
    document.getElementById('authSubtitle').textContent = isAdmin
        ? 'Sign in with the admin username to view order tools on this device.'
        : isSignup
        ? 'Create a simple account on this device so checkout details and offers stay saved.'
        : 'Sign in with your email or username to access saved details, orders, and admin tools.';
    document.getElementById('authName').parentElement.style.display = isSignup ? 'block' : 'none';
    document.getElementById('authPhone').parentElement.style.display = isSignup ? 'block' : 'none';
    document.getElementById('authSubmitBtn').textContent = isAdmin ? 'Sign In as Admin' : isSignup ? 'Create Account' : 'Sign In';
    document.getElementById('authEmail').placeholder = isAdmin ? 'Admin username' : 'your@email.com or adi24';
    if (isAdmin) document.getElementById('authEmail').value = ADMIN_USERNAME;
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
    const adminBadgeCard = document.getElementById('accountAdminBadgeCard');
    if (currentUser) {
        guestView.style.display = 'none';
        userView.style.display = 'block';
        document.getElementById('accountName').textContent = currentUser.name || 'Ruh Imperium Customer';
        document.getElementById('accountEmail').textContent = currentUser.email || currentUser.username || 'No email saved';
        document.getElementById('accountPhone').textContent = currentUser.phone || 'No phone saved';
        adminBadgeCard.classList.toggle('show', isAdminUser(currentUser));
    } else {
        guestView.style.display = 'block';
        userView.style.display = 'none';
        setAuthMode(authMode);
    }
}

function updateAccountUI() {
    const label = document.getElementById('accountLabel');
    const initial = document.getElementById('accountInitial');
    const accountAdminBadge = document.getElementById('accountAdminBadge');
    const topAdminBadge = document.getElementById('topAdminBadge');
    const ordersBtn = document.getElementById('ordersBtn');
    const adminOrdersTab = document.getElementById('adminOrdersTab');
    if (currentUser) {
        const displayName = currentUser.name || currentUser.username || 'Account';
        label.textContent = displayName.split(' ')[0];
        initial.textContent = displayName.charAt(0).toUpperCase();
    } else {
        label.textContent = 'Account';
        initial.textContent = 'A';
    }
    const showAdmin = isAdminUser(currentUser);
    if (accountAdminBadge) accountAdminBadge.classList.toggle('show', showAdmin);
    if (topAdminBadge) topAdminBadge.classList.toggle('show', showAdmin);
    if (ordersBtn) ordersBtn.style.display = currentUser ? 'inline-flex' : 'none';
    if (adminOrdersTab) adminOrdersTab.style.display = showAdmin ? 'block' : 'none';
    renderAuthView();
    renderCartItems();
}

function handleAuth() {
    const name = document.getElementById('authName').value.trim();
    const email = document.getElementById('authEmail').value.trim().toLowerCase();
    const phone = document.getElementById('authPhone').value.trim();
    const password = document.getElementById('authPassword').value.trim();
    if (!email || !password) {
        showToast('Username/email and password are required.');
        return;
    }
    if (authMode === 'signup') {
        if (!name || !phone) {
            showToast('Please complete all signup fields.');
            return;
        }
        if (email === ADMIN_USERNAME.toLowerCase()) {
            showToast('This username is reserved for admin login.');
            return;
        }
        currentUser = { name, email, phone, password };
        persistUser();
        updateAccountUI();
        prefillCheckout();
        closeAuthModal();
        showToast('Account created successfully.');
        return;
    }
    if (isAdminCredentials(email, password)) {
        currentUser = {
            name: 'Adi Admin',
            username: ADMIN_USERNAME,
            email: `${ADMIN_USERNAME}@ruhimperium.local`,
            phone: 'Admin Access',
            password,
            isAdmin: true
        };
        persistUser();
        updateAccountUI();
        closeAuthModal();
        showToast('Admin signed in successfully.');
        return;
    }
    const savedUser = JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || 'null');
    if (!savedUser || savedUser.email !== email || savedUser.password !== password) {
        showToast('No matching account found on this device.');
        return;
    }
    currentUser = savedUser;
    updateAccountUI();
    prefillCheckout();
    closeAuthModal();
    showToast('Signed in successfully.');
}

function logout() {
    currentUser = null;
    localStorage.removeItem(USER_STORAGE_KEY);
    updateAccountUI();
    closeAuthModal();
    showToast('You have been logged out.');
}

function openOrdersModal() {
    if (!currentUser) {
        showToast('Please sign in first.');
        openAuthModal();
        return;
    }
    const backendStatus = document.getElementById('backendStatus');
    const ordersList = document.getElementById('ordersList');
    const adminOrdersList = document.getElementById('adminOrdersList');
    const adminStats = document.getElementById('adminStats');
    const adminSetupGrid = document.getElementById('adminSetupGrid');

    if (backendStatus) {
        backendStatus.className = 'backend-status warning';
        backendStatus.innerHTML = `<strong>Local Mode Active</strong><span>Orders and admin tools are currently running from this device session.</span>`;
    }
    if (ordersList) {
        ordersList.innerHTML = `<div class="order-card"><div class="order-card-head"><strong>No orders yet</strong><span>Place an order to see it here.</span></div></div>`;
    }
    if (isAdminUser(currentUser)) {
        if (adminStats) {
            adminStats.innerHTML = `
                <div class="stat-card"><span>Role</span><strong>Admin</strong></div>
                <div class="stat-card"><span>Username</span><strong>${ADMIN_USERNAME}</strong></div>
                <div class="stat-card"><span>Mode</span><strong>Local</strong></div>
                <div class="stat-card"><span>Orders</span><strong>0</strong></div>
            `;
        }
        if (adminSetupGrid) {
            adminSetupGrid.innerHTML = `
                <div class="setup-card ok"><strong>Admin Access</strong><span class="setup-state">Ready</span><span>Username/password admin login is active.</span></div>
                <div class="setup-card warn"><strong>Backend</strong><span class="setup-state">Local</span><span>Deploy the backend for shared admin data across devices.</span></div>
                <div class="setup-card ok"><strong>Orders Panel</strong><span class="setup-state">Visible</span><span>Admin dashboard is unlocked for this session.</span></div>
            `;
        }
        if (adminOrdersList) {
            adminOrdersList.innerHTML = `<div class="order-card"><div class="order-card-head"><strong>Admin Panel Ready</strong><span>No order records available yet in this local session.</span></div></div>`;
        }
        const stockAlertsList = document.getElementById('stockAlertsList');
        if (stockAlertsList) {
            stockAlertsList.innerHTML = stockAlerts.length
                ? stockAlerts.map(alert => `<div class="subscriber-card"><div><strong>${escapeHTML(alert.productName)}</strong><span>${escapeHTML(alert.email)} · ${new Date(alert.createdAt).toLocaleDateString('en-IN')}</span></div></div>`).join('')
                : `<div class="order-card"><div class="order-card-head"><strong>No stock alerts yet</strong><span>Customer product alerts will appear here.</span></div></div>`;
        }
        ['sellerApplicationsList', 'sellerProductsList', 'viewSignalsList', 'abandonedCartsList'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = `<div class="order-card"><div class="order-card-head"><strong>Local mode ready</strong><span>Deploy backend storage to collect this data across devices.</span></div></div>`;
        });
    }
    document.getElementById('ordersModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeOrdersModal() {
    document.getElementById('ordersModal').classList.remove('open');
    document.body.style.overflow = '';
}

function getProductToneScore(product, prompt) {
    const text = String(prompt || '').toLowerCase();
    const blob = [product.name, product.cat, product.notes, product.desc, ...(product.tags || [])].join(' ').toLowerCase();
    let score = 0;
    text.split(/[^a-z0-9]+/i).filter(term => term.length > 2).forEach(term => {
        if (blob.includes(term)) score += 2;
    });
    [
        { terms: ['fresh', 'cool', 'clean', 'summer', 'office', 'light'], matches: ['fresh', 'summer', 'office', 'green apple', 'tommy girl', 'hawas', 'khus'] },
        { terms: ['floral', 'flower', 'romantic', 'rose', 'jasmine', 'mogra', 'soft'], matches: ['floral', 'rose', 'jasmine', 'mogra', 'gulab'] },
        { terms: ['woody', 'earthy', 'deep', 'mitti', 'rain', 'sandal', 'oud'], matches: ['woody', 'earthy', 'mitti', 'sandal', 'oud', 'khus'] },
        { terms: ['sweet', 'vanilla', 'caramel', 'gourmand', 'warm', 'cozy'], matches: ['vanilla', 'caramel', 'gourmand', 'eclair', 'apple'] },
        { terms: ['gift', 'gifting', 'birthday', 'wedding', 'set', 'festival'], matches: ['gifting', 'festival', 'discovery', 'set'] },
        { terms: ['party', 'bold', 'strong', 'night', 'date', 'winter'], matches: ['party', 'winter', 'musk', 'oud', 'oriental', 'amber'] }
    ].forEach(group => {
        if (group.terms.some(term => text.includes(term))) {
            group.matches.forEach(match => {
                if (blob.includes(match)) score += 4;
            });
        }
    });
    if (product.bestseller) score += 1;
    return score;
}

function getLocalToneMatches(prompt, limit = 4) {
    return products
        .map(product => ({ product, score: getProductToneScore(product, prompt) }))
        .sort((a, b) => b.score - a.score || b.product.stars - a.product.stars || a.product.price - b.product.price)
        .slice(0, limit)
        .map(entry => entry.product);
}

function buildLocalAssistantReply(prompt, matches) {
    if (!matches.length) return 'Tell me if you want fresh, floral, woody, sweet, office, party, summer, winter, or gifting and I will narrow it down.';
    return `For ${prompt}, start with ${matches.slice(0, 3).map(item => item.name).join(', ')}. These match your tone by note family, use-case, and price.`;
}

function normalizeSuggestion(product) {
    return {
        id: product.id,
        name: product.name,
        img: product.img,
        cat: product.cat,
        notes: product.notes,
        price: product.price,
        stars: product.stars,
        desc: product.desc
    };
}

function openScentAssistant(seedText = '') {
    const panel = document.getElementById('scentAssistantPanel');
    if (!panel) return;
    panel.classList.add('open');
    document.getElementById('aiScentBtn')?.classList.add('active');
    if (!document.querySelector('.scent-message')) {
        appendScentMessage('assistant', 'Tell me your tone: fresh, floral, woody, sweet, office, party, gifting, summer, or winter. I will match products from Ruh Imperium.');
    }
    const input = document.getElementById('scentInput');
    if (seedText && input) input.value = seedText;
    setTimeout(() => input?.focus(), 120);
}

function closeScentAssistant() {
    document.getElementById('scentAssistantPanel')?.classList.remove('open');
    document.getElementById('aiScentBtn')?.classList.remove('active');
}

function toggleScentAssistant() {
    const panel = document.getElementById('scentAssistantPanel');
    if (panel?.classList.contains('open')) closeScentAssistant();
    else openScentAssistant();
}

function appendScentMessage(role, text, suggestions = [], isLoading = false) {
    const messages = document.getElementById('scentMessages');
    if (!messages) return null;
    const bubble = document.createElement('div');
    bubble.className = `scent-message ${role}${isLoading ? ' loading' : ''}`;
    const copy = document.createElement('p');
    copy.textContent = text;
    bubble.appendChild(copy);
    if (suggestions.length) {
        const list = document.createElement('div');
        list.className = 'scent-suggestions';
        suggestions.forEach(product => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'scent-suggestion-card';
            card.onclick = () => {
                closeScentAssistant();
                openProductModal(product.id);
            };
            card.innerHTML = `
                <img src="${escapeHTML(product.img)}" alt="${escapeHTML(product.name)}" onerror="this.style.display='none'">
                <span><strong>${escapeHTML(product.name)}</strong><small>${escapeHTML(product.notes)} · ${formatMoney(product.price)}</small></span>
            `;
            list.appendChild(card);
        });
        bubble.appendChild(list);
    }
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
}

async function sendScentMessage(event, presetText = '') {
    if (event) event.preventDefault();
    const input = document.getElementById('scentInput');
    const message = (presetText || input?.value || '').trim();
    if (!message) return;
    openScentAssistant();
    appendScentMessage('user', message);
    if (input) input.value = '';
    const loading = appendScentMessage('assistant', 'Matching your tone with the catalog...', [], true);
    try {
        const response = await fetch('/api/ai-scent-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Assistant unavailable.');
        loading?.remove();
        appendScentMessage('assistant', data.reply || 'Here are a few matches from the catalog.', data.suggestions || []);
    } catch (error) {
        loading?.remove();
        const matches = getLocalToneMatches(message, 4);
        appendScentMessage('assistant', buildLocalAssistantReply(message, matches), matches.map(normalizeSuggestion));
    }
}

function askScentAssistantPreset(text) {
    openScentAssistant(text);
    sendScentMessage(null, text);
}

function updatePinServiceability() {
    const status = document.getElementById('pinServiceabilityStatus');
    if (!status) return;
    const { state, pin } = getCheckoutCustomerSnapshot();
    const subtotalAfterDiscount = Math.max(getCartTotal() - getDiscountAmount(), 0);
    const delivery = getDeliveryCharge(subtotalAfterDiscount);
    if (!pin) {
        status.textContent = 'Enter PIN code to check delivery availability and shipping.';
    } else if (!/^\d{6}$/.test(pin)) {
        status.textContent = 'Use a 6-digit Indian PIN code for the best delivery estimate.';
    } else if (delivery) {
        status.textContent = `${state || 'Selected state'} is serviceable. Estimated shipping: ${formatMoney(delivery)}.`;
    } else {
        status.textContent = 'Great, this PIN is serviceable with free delivery estimate.';
    }
    updateOrderSummary();
    renderCartItems();
}

function initCheckoutHelpers() {
    const refresh = debounce(updatePinServiceability, 180);
    document.getElementById('cPin')?.addEventListener('input', refresh);
    document.getElementById('cState')?.addEventListener('change', updatePinServiceability);
    selectPay(document.getElementById('payRazorpayBtn') || { classList: { add() {} } }, selectedPayment);
}

function renderReviewProducts() {
    const select = document.getElementById('reviewProduct');
    if (!select) return;
    select.innerHTML = products.map(product => `<option value="${escapeHTML(product.name)}">${escapeHTML(product.name)}</option>`).join('');
}

function renderCustomerReviews() {
    const list = document.getElementById('customerReviewList');
    if (!list) return;
    const allReviews = [...customerReviews, ...baseReviews].slice(0, 6);
    list.innerHTML = allReviews.map((review, index) => `
        <div class="review-card reveal ${index % 3 === 1 ? 'reveal-delay-1' : index % 3 === 2 ? 'reveal-delay-2' : ''}">
            <div class="review-stars">${'★'.repeat(Number(review.rating || 5))}${'☆'.repeat(5 - Number(review.rating || 5))}</div>
            <p class="review-text">"${escapeHTML(review.comment)}"</p>
            <div class="reviewer"><div class="reviewer-avatar">${escapeHTML((review.name || 'R').charAt(0).toUpperCase())}</div><div><span class="reviewer-name">${escapeHTML(review.name)}</span><span class="reviewer-date">${escapeHTML(review.date || new Date(review.createdAt || Date.now()).toLocaleDateString('en-IN'))}</span><span class="reviewer-product">${escapeHTML(review.product)}</span></div></div>
        </div>
    `).join('');
    const totalRating = allReviews.reduce((sum, review) => sum + Number(review.rating || 5), 0);
    const average = allReviews.length ? (totalRating / allReviews.length).toFixed(1) : '4.8';
    document.getElementById('liveReviewAverage').textContent = average;
    document.getElementById('liveReviewCount').textContent = `Based on ${allReviews.length.toLocaleString('en-IN')} featured reviews`;
}

function submitReview() {
    const name = document.getElementById('reviewName').value.trim();
    const product = document.getElementById('reviewProduct').value;
    const rating = Number(document.getElementById('reviewRating').value || 5);
    const comment = document.getElementById('reviewComment').value.trim();
    if (!name || !comment) {
        showToast('Name and review are required.');
        return;
    }
    customerReviews.unshift({
        id: Date.now().toString(36),
        name,
        product,
        rating,
        comment,
        createdAt: new Date().toISOString(),
        date: new Date().toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })
    });
    persistState();
    document.getElementById('reviewName').value = '';
    document.getElementById('reviewComment').value = '';
    renderCustomerReviews();
    initReveals();
    showToast('Review added. Thank you.');
}

function getAdminBackupData() {
    return {
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        cart,
        wishlist,
        currentUser,
        compareProducts,
        recentlyViewed,
        customerReviews,
        stockAlerts
    };
}

function downloadTextFile(filename, content, type = 'application/json') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function exportAdminBackup() {
    downloadTextFile(`ruh-imperium-backup-${Date.now()}.json`, JSON.stringify(getAdminBackupData(), null, 2));
    showToast('Backup exported.');
}

function triggerBackupImport() {
    document.getElementById('backupImportInput')?.click();
}

function restoreAdminBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);
            if (Array.isArray(data.cart)) cart = data.cart;
            if (Array.isArray(data.wishlist)) wishlist = data.wishlist;
            if (Array.isArray(data.compareProducts)) compareProducts = data.compareProducts;
            if (Array.isArray(data.recentlyViewed)) recentlyViewed = data.recentlyViewed;
            if (Array.isArray(data.customerReviews)) customerReviews = data.customerReviews;
            if (Array.isArray(data.stockAlerts)) stockAlerts = data.stockAlerts;
            if (data.currentUser) currentUser = data.currentUser;
            persistState();
            persistUser();
            updateCartBadge();
            updateWishBadge();
            updateAccountUI();
            renderHomeSections();
            renderCustomerReviews();
            showToast('Backup restored.');
        } catch (error) {
            showToast('Backup file could not be restored.');
        }
    };
    reader.readAsText(file);
}

function setAdminFilterPreset(preset) {
    currentAdminPreset = preset;
    document.querySelectorAll('[data-admin-preset]').forEach(btn => btn.classList.toggle('active', btn.dataset.adminPreset === preset));
    filterAdminOrders();
}

function filterAdminOrders() {
    const count = document.getElementById('adminOrderCount');
    if (count) count.textContent = currentAdminPreset === 'all' ? '0 orders shown' : `0 ${currentAdminPreset.replace('-', ' ')} orders shown`;
}

function exportAdminOrdersCsv() {
    downloadTextFile('ruh-imperium-orders.csv', 'Order ID,Customer,Total,Status\n', 'text/csv;charset=utf-8');
    showToast('Orders CSV exported.');
}

function filterAdminSubscribers() {
    const count = document.getElementById('adminSubscriberCount');
    if (count) count.textContent = '0 subscribers shown';
}

function copyAllSubscriberEmails() {
    const emails = [];
    navigator.clipboard?.writeText(emails.join(', '));
    showToast('No subscriber emails available in local mode yet.');
}

function exportAdminSubscribersCsv() {
    downloadTextFile('ruh-imperium-subscribers.csv', 'Email,Created At\n', 'text/csv;charset=utf-8');
    showToast('Subscribers CSV exported.');
}

function initMobileDeepLinks() {
    const productId = Number(new URLSearchParams(window.location.search).get('product'));
    if (productId) setTimeout(() => openProductModal(productId), 300);
}

function initReveals() {
    const reveals = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    reveals.forEach(el => observer.observe(el));
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeSearch(); closeProductModal(); closeCheckout(); closeAuthModal(); closeMobileMenu(); closeCompareModal(); closeScentAssistant(); }
});

window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    setInstallButtonVisibility(true);
});

window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    setInstallButtonVisibility(false);
    showToast('Ruh Imperium app installed successfully.');
});

loadStoredState();
updateCurrency(selectedCurrency, false);
renderHomeSections();
updateWishBadge();
updateCartBadge();
updateAccountUI();
updateCouponUI();
updateOrderSummary();
prefillCheckout();
renderCartItems();
renderCompareBar();
renderReviewProducts();
renderCustomerReviews();
initCheckoutHelpers();
initReveals();
initMobileDeepLinks();
document.getElementById('backupImportInput')?.addEventListener('change', event => restoreAdminBackup(event.target.files?.[0]));
setInstallButtonVisibility(false);
