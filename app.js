const CART_STORAGE_KEY = 'ruhImperiumCart';
const WISHLIST_STORAGE_KEY = 'ruhImperiumWishlist';
const USER_STORAGE_KEY = 'ruhImperiumUser';
const COUPON_STORAGE_KEY = 'ruhImperiumCoupon';
const CURRENCY_STORAGE_KEY = 'ruhImperiumCurrency';
const COMPARE_STORAGE_KEY = 'ruhImperiumCompare';
const RAZORPAY_KEY_ID = 'rzp_test_replace_with_your_key';
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
    } catch (error) {
        cart = [];
        wishlist = [];
        currentUser = null;
        appliedCoupon = null;
        selectedCurrency = detectPreferredCurrency();
        compareProducts = [];
    }
}

function persistState() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlist));
    localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(appliedCoupon));
    localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(compareProducts));
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
    document.getElementById('bestsellerGrid').innerHTML = bestsellers.map(p => productCardHTML(p)).join('');
    const newArrivals = products.filter(p => p.cat === 'Next Gen Fragrances').slice(0, 4);
    document.getElementById('newArrivalsGrid').innerHTML = newArrivals.map(p => productCardHTML(p)).join('');
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
    document.getElementById('cartBadge').textContent = cart.reduce((a, x) => a + x.qty, 0);
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

function getDiscountAmount(subtotal = getCartTotal()) {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.type === 'percent') return Math.round(subtotal * (appliedCoupon.value / 100));
    return Math.min(appliedCoupon.value, subtotal);
}

function getOrderPricing() {
    const subtotal = getCartTotal();
    const discount = getDiscountAmount(subtotal);
    return {
        subtotal,
        discount,
        delivery: 0,
        total: Math.max(subtotal - discount, 0)
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
    msg += `\n*Total: ${formatMoney(pricing.total)}*\n\nPlease confirm my order. Thank you!`;
    window.open('https://wa.me/919785854770?text=' + encodeURIComponent(msg), '_blank');
}

function openProductModal(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    currentProduct = p;

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
        `<div class="order-line"><span>Delivery</span><span style="color:var(--green)">FREE</span></div>` +
        `<div class="order-line"><span>Total</span><span>${formatMoney(pricing.total)}</span></div>`;
}

function selectPay(btn, type) {
    selectedPayment = type;
    document.querySelectorAll('.pay-opt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const note = document.getElementById('checkoutNote');
    if (note) {
        note.textContent = type === 'COD'
            ? 'Cash on Delivery orders are confirmed instantly and shared to WhatsApp for manual processing.'
            : 'Razorpay supports UPI, cards, netbanking, and wallets. Replace the demo key in `app.js` before taking live payments.';
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
    const options = {
        key: RAZORPAY_KEY_ID,
        amount: pricing.total * 100,
        currency: 'INR',
        name: 'Ruh Imperium',
        description: `Order for ${details.name}`,
        image: 'gulabattar.png',
        handler(response) {
            launchWhatsAppOrder(details, 'Razorpay', response.razorpay_payment_id);
            finalizeOrder('Payment received successfully via Razorpay.');
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

function subscribe() {
    const email = document.getElementById('nlEmail').value;
    if (!email || !email.includes('@')) { showToast('Please enter a valid email!'); return; }
    document.getElementById('nlEmail').value = '';
    showToast('🌸 Subscribed! Welcome to the Ruh Imperium family.');
}

function setAuthMode(mode) {
    authMode = mode;
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

function updateAccountUI() {
    const label = document.getElementById('accountLabel');
    const initial = document.getElementById('accountInitial');
    if (currentUser) {
        label.textContent = currentUser.name.split(' ')[0];
        initial.textContent = currentUser.name.charAt(0).toUpperCase();
    } else {
        label.textContent = 'Account';
        initial.textContent = 'A';
    }
    renderAuthView();
    renderCartItems();
}

function handleAuth() {
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
        currentUser = { name, email, phone, password };
        persistUser();
        updateAccountUI();
        prefillCheckout();
        closeAuthModal();
        showToast('Account created successfully.');
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

function initReveals() {
    const reveals = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    reveals.forEach(el => observer.observe(el));
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeSearch(); closeProductModal(); closeCheckout(); closeAuthModal(); closeMobileMenu(); closeCompareModal(); }
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
initReveals();
setInstallButtonVisibility(false);
