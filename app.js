const CART_STORAGE_KEY = 'ruhImperiumCart';
const WISHLIST_STORAGE_KEY = 'ruhImperiumWishlist';
const USER_STORAGE_KEY = 'ruhImperiumUser';
const SESSION_STORAGE_KEY = 'ruhImperiumSession';
const COUPON_STORAGE_KEY = 'ruhImperiumCoupon';

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
let apiConfig = { backendReady: false, razorpayKeyId: '', adminEnabled: false };
let orderHistory = [];
const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered'];

function loadStoredState() {
    try {
        cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
        wishlist = JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY) || '[]');
        currentUser = JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || 'null');
        sessionToken = localStorage.getItem(SESSION_STORAGE_KEY) || '';
        appliedCoupon = JSON.parse(localStorage.getItem(COUPON_STORAGE_KEY) || 'null');
    } catch (error) {
        cart = [];
        wishlist = [];
        currentUser = null;
        sessionToken = '';
        appliedCoupon = null;
    }
}

function persistState() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlist));
    localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(appliedCoupon));
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

async function apiFetch(path, options = {}, needsAuth = false) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };
    if (needsAuth && sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
    const response = await fetch(path, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Request failed.');
    return data;
}

async function loadApiConfig() {
    try {
        const data = await apiFetch('/api/config');
        apiConfig = {
            backendReady: true,
            razorpayKeyId: data.razorpayKeyId || '',
            adminEnabled: Boolean(data.adminEnabled)
        };
    } catch (error) {
        apiConfig = { backendReady: false, razorpayKeyId: '', adminEnabled: false };
    }
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
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
        if (el) el.scrollIntoView({ behavior: 'smooth' });
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
        showToast('Start the backend to validate coupons.');
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
    const note = document.getElementById('checkoutNote');
    if (!note) return;
    note.textContent = type === 'COD'
        ? 'Cash on Delivery orders are confirmed instantly and shared to WhatsApp for manual processing.'
        : 'Razorpay supports UPI, cards, netbanking, and wallets through the backend order API.';
}

function prefillCheckout() {
    if (!currentUser) return;
    document.getElementById('cName').value = currentUser.name || '';
    document.getElementById('cPhone').value = currentUser.phone || '';
    document.getElementById('cEmail').value = currentUser.email || '';
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
        showToast(error.message);
    }
}

async function processRazorpayOrder(details) {
    if (typeof Razorpay === 'undefined') {
        showToast('Razorpay failed to load. Please try again.');
        return;
    }
    if (!apiConfig.backendReady || !apiConfig.razorpayKeyId) {
        showToast('Backend Razorpay config is missing. Add your keys and restart the server.');
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

async function openOrderDocument(orderId, type) {
    if (!sessionToken) {
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
            try {
                const data = JSON.parse(html);
                throw new Error(data.error || 'Unable to open document.');
            } catch (error) {
                throw new Error('Unable to open document.');
            }
        }
        const docWindow = window.open('', '_blank', 'noopener,noreferrer');
        if (!docWindow) {
            showToast('Please allow pop-ups to open the document.');
            return;
        }
        docWindow.document.open();
        docWindow.document.write(html);
        docWindow.document.close();
    } catch (error) {
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
                    <strong>${order.id.slice(0, 8).toUpperCase()}</strong>
                    <span>${formatDate(order.createdAt)}</span>
                </div>
                <div class="order-badges">
                    <div class="order-status ${String(order.paymentStatus).toLowerCase()}">${order.paymentMethod} · ${order.paymentStatus}</div>
                    <div class="order-status order-flow ${String(order.orderStatus || 'pending').toLowerCase()}">Order · ${titleCase(order.orderStatus || 'pending')}</div>
                </div>
            </div>
            <div class="order-items">${order.items.map(item => `${item.name} (${item.size}) × ${item.qty}`).join('<br>')}</div>
            <div class="order-meta-line">Total: ₹${Number(order.total).toLocaleString()}${order.couponCode ? ` · Coupon: ${order.couponCode}` : ''}</div>
            <div class="order-action-row">
                <button class="order-action-btn" onclick="openOrderDocument('${order.id}','invoice')">Invoice</button>
                <button class="order-action-btn" onclick="openOrderDocument('${order.id}','packing-slip')">Packing Slip</button>
            </div>
            ${targetId === 'adminOrdersList' ? `<div class="order-meta-line">${order.customerName} · ${order.customerPhone} · ${order.customerEmail || ''}</div>
            <div class="admin-status-row">
                <label for="order-status-${order.id}">Update status</label>
                <select id="order-status-${order.id}" onchange="updateAdminOrderStatus('${order.id}', this.value)">
                    ${ORDER_STATUSES.map(status => `<option value="${status}" ${status === (order.orderStatus || 'pending') ? 'selected' : ''}>${titleCase(status)}</option>`).join('')}
                </select>
            </div>` : ''}
        </div>
    `).join('');
}

async function loadMyOrders() {
    if (!sessionToken) return;
    try {
        const data = await apiFetch('/api/orders', {}, true);
        orderHistory = data.orders || [];
        renderOrders(orderHistory, 'ordersList', 'No orders yet. Your placed orders will appear here.');
    } catch (error) {
        renderOrders([], 'ordersList', 'Unable to load orders right now.');
    }
}

async function loadAdminOrders() {
    if (!currentUser || !currentUser.isAdmin) return;
    try {
        const data = await apiFetch('/api/admin/orders', {}, true);
        renderOrders(data.orders || [], 'adminOrdersList', 'No orders have been placed yet.');
    } catch (error) {
        renderOrders([], 'adminOrdersList', error.message);
    }
}

async function updateAdminOrderStatus(orderId, orderStatus) {
    if (!currentUser || !currentUser.isAdmin) return;
    try {
        await apiFetch(`/api/admin/orders/${orderId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ orderStatus })
        }, true);
        showToast(`Order marked as ${titleCase(orderStatus)}.`);
        await loadAdminOrders();
        await loadMyOrders();
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

function subscribe() {
    const email = document.getElementById('nlEmail').value;
    if (!email || !email.includes('@')) {
        showToast('Please enter a valid email!');
        return;
    }
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
        ? 'Create your account on the backend so checkout and payments stay tied to a real user profile.'
        : 'Sign in to access saved details, backend coupon validation, and Razorpay checkout.';
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
    const ordersBtn = document.getElementById('ordersBtn');
    const adminTab = document.getElementById('adminOrdersTab');
    if (ordersBtn) ordersBtn.style.display = currentUser ? 'flex' : 'none';
    if (adminTab) adminTab.style.display = currentUser && currentUser.isAdmin ? 'block' : 'none';
    renderAuthView();
    renderCartItems();
}

async function handleAuth() {
    if (!apiConfig.backendReady) {
        showToast('Start the backend before signing in.');
        return;
    }
    const name = document.getElementById('authName').value.trim();
    const email = document.getElementById('authEmail').value.trim().toLowerCase();
    const phone = document.getElementById('authPhone').value.trim();
    const password = document.getElementById('authPassword').value.trim();
    if (!email || !password) {
        showToast('Email and password are required.');
        return;
    }
    if (authMode === 'signup' && (!name || !phone)) {
        showToast('Please complete all signup fields.');
        return;
    }
    try {
        const path = authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
        const data = await apiFetch(path, {
            method: 'POST',
            body: JSON.stringify({ name, email, phone, password })
        });
        currentUser = data.user;
        sessionToken = data.token;
        persistUser();
        updateAccountUI();
        prefillCheckout();
        closeAuthModal();
        showToast(authMode === 'signup' ? 'Account created successfully.' : 'Signed in successfully.');
    } catch (error) {
        showToast(error.message);
    }
}

function logout() {
    clearUserState();
    orderHistory = [];
    updateAccountUI();
    renderOrders([], 'ordersList', 'Sign in to view your orders.');
    renderOrders([], 'adminOrdersList', 'Admin orders will appear here.');
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
    if (currentUser) loadMyOrders();
    initReveals();
}

initApp();
