// Removed invalid module import for browser script
let cart            = [];
let wishlist        = [];
let currentFilter   = 'all';
let maxPrice        = 5000;
let sortMode        = 'default';
let selectedPayment = 'UPI';
let currentProduct  = null;

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
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
    document.getElementById('priceVal').textContent = '₹' + val;
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
            <span class="product-price">₹${p.price.toLocaleString()}</span>
            ${p.oldPrice ? `<span class="product-price-old">₹${p.oldPrice.toLocaleString()}</span>` : ''}
          </div>
          <button class="add-btn" onclick="quickAdd(event,${p.id})">Add to Cart</button>
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

function addToCart(p, size) {
    const existing = cart.find(x => x.id === p.id && x.size === size);
    if (existing) existing.qty++;
    else cart.push({ id: p.id, name: p.name, img: p.img, price: p.price, size, qty: 1 });
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
    if (cart.length === 0) {
        el.innerHTML = '<div class="cart-empty"><span>🧴</span><p>Your cart is beautifully empty</p></div>';
        footer.style.display = 'none';
        return;
    }
    footer.style.display = 'block';
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
    document.getElementById('cartTotal').textContent = '₹' + getCartTotal().toLocaleString();
}

function changeQty(i, delta) {
    cart[i].qty += delta;
    if (cart[i].qty <= 0) cart.splice(i, 1);
    updateCartBadge();
    renderCartItems();
}

function removeFromCart(i) {
    cart.splice(i, 1);
    updateCartBadge();
    renderCartItems();
}

function getCartTotal() {
    return cart.reduce((a, x) => a + x.price * x.qty, 0);
}

//WhatsApp Order
function whatsappOrder() {
    if (cart.length === 0) { showToast('Cart is empty!'); return; }
    let msg = '🌹 *Ruh Imperium Order* 🌹\n\nI would like to order:\n\n';
    cart.forEach(item => { msg += `• ${item.name} (${item.size}) × ${item.qty} = ₹${(item.price * item.qty).toLocaleString()}\n`; });
    msg += `\n*Total: ₹${getCartTotal().toLocaleString()}*\n\nPlease confirm my order. Thank you!`;
    window.open('https://wa.me/919785854770?text=' + encodeURIComponent(msg), '_blank');
}

function openProductModal(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    currentProduct = p;

    document.getElementById('modalCat').textContent    = p.cat;
    document.getElementById('modalName').textContent   = p.name;
    document.getElementById('modalStars').innerHTML    = starStr(p.stars) + ` <span>(${p.reviews} reviews)</span>`;
    document.getElementById('modalPrice').textContent  = '₹' + p.price.toLocaleString();
    document.getElementById('modalOldPrice').textContent = p.oldPrice ? '₹' + p.oldPrice.toLocaleString() : '';
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
    };
    setAddBtn(selectedSize);

    document.getElementById('modalWaBtn').onclick = () => {
        const msg = `Hello! I am interested in *${p.name}* (${selectedSize}) at ₹${p.price.toLocaleString()}. Please help me place an order.`;
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

function closeModal(e) {
    if (e.target === document.getElementById('productModal')) closeProductModal();
}

function openCheckout() {
    if (cart.length === 0) { showToast('Cart is empty!'); return; }
    closeCart();
    const summary = document.getElementById('orderSummary');
    summary.innerHTML = '<h3>Order Summary</h3>' +
        cart.map(item =>
            `<div class="order-line"><span>${item.name} (${item.size}) × ${item.qty}</span><span>₹${(item.price * item.qty).toLocaleString()}</span></div>`
        ).join('') +
        `<div class="order-line"><span>Delivery</span><span style="color:var(--green)">FREE</span></div>` +
        `<div class="order-line"><span>Total</span><span>₹${getCartTotal().toLocaleString()}</span></div>`;
    document.getElementById('checkoutModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeCheckout() {
    document.getElementById('checkoutModal').classList.remove('open');
    document.body.style.overflow = '';
}

function selectPay(btn, type) {
    selectedPayment = type;
    document.querySelectorAll('.pay-opt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

function placeOrder() {
    const name    = document.getElementById('cName').value.trim();
    const phone   = document.getElementById('cPhone').value.trim();
    const address = document.getElementById('cAddress').value.trim();
    const city    = document.getElementById('cCity').value.trim();
    const pin     = document.getElementById('cPin').value.trim();
    if (!name || !phone || !address || !city || !pin) { showToast('Please fill all required fields!'); return; }

    let msg = `🌹 *New Order - Ruh Imperium* 🌹\n\n`;
    msg += `*Customer:* ${name}\n*Phone:* ${phone}\n*City:* ${city} - ${pin}\n*Payment:* ${selectedPayment}\n\n`;
    msg += `*Order Details:*\n`;
    cart.forEach(item => { msg += `• ${item.name} (${item.size}) × ${item.qty} = ₹${(item.price * item.qty).toLocaleString()}\n`; });
    msg += `\n*Total: ₹${getCartTotal().toLocaleString()}*`;

    window.open('https://wa.me/919785854770?text=' + encodeURIComponent(msg), '_blank');
    closeCheckout();
    cart = [];
    updateCartBadge();
    renderCartItems();
    showToast('🎉 Order placed! Check WhatsApp for confirmation.');
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
        <p>${p.cat} · ₹${p.price.toLocaleString()}</p>
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

function initReveals() {
    const reveals = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    reveals.forEach(el => observer.observe(el));
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeSearch(); closeProductModal(); closeCheckout(); }
});

renderHomeSections();
initReveals();
