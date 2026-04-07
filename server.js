// SERVER CORE AND DEPLOYMENT SETUP
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const { DatabaseSync } = require('node:sqlite');
const { MongoClient } = require('mongodb');

const ROOT = __dirname;
loadEnvFile(path.join(ROOT, '.env'));
const DEFAULT_DATA_DIR = process.env.VERCEL ? path.join('/tmp', 'ruh-imperium-data') : path.join(ROOT, 'data');
const DATA_DIR = path.resolve(process.env.DATA_DIR || DEFAULT_DATA_DIR);
const DB_FILE = path.join(DATA_DIR, 'ruh-imperium.sqlite');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const OTPS_FILE = path.join(DATA_DIR, 'otps.json');
const SUBSCRIBERS_FILE = path.join(DATA_DIR, 'subscribers.json');
// ENVIRONMENT AND SERVICE CONFIG SETUP
const PORT = Number(process.env.PORT || 3000);
const TOKEN_SECRET = process.env.AUTH_SECRET || 'change-this-auth-secret';
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const GOOGLE_ANALYTICS_ID = String(process.env.GOOGLE_ANALYTICS_ID || '').trim();
const GOOGLE_SITE_VERIFICATION = String(process.env.GOOGLE_SITE_VERIFICATION || '').trim();
const RECAPTCHA_SITE_KEY = String(process.env.RECAPTCHA_SITE_KEY || '').trim();
const RECAPTCHA_SECRET_KEY = String(process.env.RECAPTCHA_SECRET_KEY || '').trim();
const SMTP_HOST = String(process.env.SMTP_HOST || '').trim();
const SMTP_PORT = String(process.env.SMTP_PORT || '').trim();
const SMTP_USER = String(process.env.SMTP_USER || '').trim();
const SMTP_PASS = String(process.env.SMTP_PASS || '').trim();
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const OTP_PROVIDER = String(process.env.OTP_PROVIDER || '').trim().toLowerCase();
const MSG91_AUTH_KEY = String(process.env.MSG91_AUTH_KEY || '').trim();
const MSG91_TEMPLATE_ID = String(process.env.MSG91_TEMPLATE_ID || '').trim();
const MSG91_SENDER_ID = String(process.env.MSG91_SENDER_ID || '').trim();
const MSG91_ROUTE = String(process.env.MSG91_ROUTE || '4').trim();
const MONGODB_URI = String(process.env.MONGODB_URI || '').trim();
const MONGODB_DB_NAME = String(process.env.MONGODB_DB_NAME || 'ruhImperium').trim();
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const MONGODB_ENABLED = Boolean(MONGODB_URI);
const REMOTE_DB_ENABLED = MONGODB_ENABLED || Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
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

// COUPON VALIDATION SETUP
const coupons = {
    RAMJI20: { type: 'percent', value: 20, label: 'Ram Ji Signature Offer', expiresAt: '2027-03-31T23:59:59.000Z' },
    WELCOME10: { type: 'percent', value: 10, label: 'Welcome Offer', expiresAt: '2027-03-31T23:59:59.000Z' },
    ATTAR250: { type: 'flat', value: 250, minOrder: 1500, label: 'Flat Rs. 250 Off', expiresAt: '2027-03-31T23:59:59.000Z' },
    ADI50: { type: 'percent', value: 50, label: 'SPECIAL OFFER', expiresAt: '2027-03-31T23:59:59.000Z' }
};

const PARTIAL_COD_DEPOSIT_PERCENT = 20;

const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

if (!REMOTE_DB_ENABLED) ensureDataStore();
const db = REMOTE_DB_ENABLED ? null : openDatabase();
let mongoClientPromise = null;
const productCatalog = loadProducts();

function loadEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    content.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const separatorIndex = trimmed.indexOf('=');
        if (separatorIndex === -1) return;
        const key = trimmed.slice(0, separatorIndex).trim();
        if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) return;
        let value = trimmed.slice(separatorIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
            value = value.slice(1, -1);
        }
        process.env[key] = value;
    });
}

function ensureDataStore() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function openDatabase() {
    const database = new DatabaseSync(DB_FILE);
    database.exec(`
        CREATE TABLE IF NOT EXISTS app_store (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    `);
    seedCollection(database, 'users', USERS_FILE);
    seedCollection(database, 'orders', ORDERS_FILE);
    seedCollection(database, 'otps', OTPS_FILE);
    seedCollection(database, 'subscribers', SUBSCRIBERS_FILE);
    return database;
}

function seedCollection(database, key, legacyFile) {
    const existing = database.prepare('SELECT key FROM app_store WHERE key = ?').get(key);
    if (existing) return;
    let value = [];
    if (fs.existsSync(legacyFile)) {
        try {
            value = JSON.parse(fs.readFileSync(legacyFile, 'utf8'));
        } catch (error) {
            value = [];
        }
    }
    database.prepare('INSERT INTO app_store (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
}

function readCollectionLocal(key) {
    const row = db.prepare('SELECT value FROM app_store WHERE key = ?').get(key);
    if (!row) return [];
    try {
        return JSON.parse(row.value);
    } catch (error) {
        return [];
    }
}

function writeCollectionLocal(key, value) {
    db.prepare(`
        INSERT INTO app_store (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, JSON.stringify(value));
}

function getLegacyCollectionSeed(key) {
    const legacyMap = {
        users: USERS_FILE,
        orders: ORDERS_FILE,
        otps: OTPS_FILE,
        subscribers: SUBSCRIBERS_FILE
    };
    const legacyFile = legacyMap[key];
    if (!legacyFile || !fs.existsSync(legacyFile)) return [];
    try {
        return JSON.parse(fs.readFileSync(legacyFile, 'utf8'));
    } catch (error) {
        return [];
    }
}

async function getMongoCollection() {
    if (!MONGODB_ENABLED) return null;
    if (!mongoClientPromise) {
        mongoClientPromise = MongoClient.connect(MONGODB_URI, {
            maxPoolSize: 10
        });
    }
    const client = await mongoClientPromise;
    const database = client.db(MONGODB_DB_NAME);
    const collection = database.collection('app_store');
    await collection.createIndex({ _id: 1 }, { unique: true });
    return collection;
}

async function readCollectionMongo(key) {
    const collection = await getMongoCollection();
    const document = await collection.findOne({ _id: key });
    if (!document) {
        const seeded = getLegacyCollectionSeed(key);
        await collection.updateOne(
            { _id: key },
            {
                $setOnInsert: {
                    value: seeded,
                    updatedAt: new Date()
                }
            },
            { upsert: true }
        );
        return seeded;
    }
    return Array.isArray(document.value) ? document.value : [];
}

async function writeCollectionMongo(key, value) {
    const collection = await getMongoCollection();
    await collection.updateOne(
        { _id: key },
        {
            $set: {
                value,
                updatedAt: new Date()
            }
        },
        { upsert: true }
    );
}

async function requestRemoteCollection(resourcePath, init = {}) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${resourcePath}`, {
        ...init,
        headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation,resolution=merge-duplicates',
            ...(init.headers || {})
        }
    });
    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(errorText || 'Hosted database request failed.');
    }
    if (response.status === 204) return null;
    return response.json().catch(() => null);
}

async function readCollection(key) {
    if (MONGODB_ENABLED) return readCollectionMongo(key);
    if (!REMOTE_DB_ENABLED) return readCollectionLocal(key);
    const rows = await requestRemoteCollection(`app_store?key=eq.${encodeURIComponent(key)}&select=value&limit=1`, {
        method: 'GET',
        headers: {
            Prefer: 'return=representation'
        }
    });
    const value = Array.isArray(rows) && rows[0] ? rows[0].value : [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch (error) {
            return [];
        }
    }
    return value && typeof value === 'object' ? value : [];
}

async function writeCollection(key, value) {
    if (MONGODB_ENABLED) {
        await writeCollectionMongo(key, value);
        return;
    }
    if (!REMOTE_DB_ENABLED) {
        writeCollectionLocal(key, value);
        return;
    }
    await requestRemoteCollection('app_store?on_conflict=key', {
        method: 'POST',
        body: JSON.stringify([{
            key,
            value,
            updated_at: new Date().toISOString()
        }])
    });
}

function loadProducts() {
    const file = fs.readFileSync(path.join(ROOT, 'products.js'), 'utf8');
    const context = { globalThis: {} };
    vm.createContext(context);
    vm.runInContext(`${file}\nglobalThis.__products = products;`, context);
    return context.globalThis.__products || [];
}

async function readUsers() {
    return readCollection('users');
}

async function writeUsers(users) {
    await writeCollection('users', users);
}

async function readOrders() {
    return readCollection('orders');
}

async function writeOrders(orders) {
    await writeCollection('orders', orders);
}

async function readOtps() {
    return readCollection('otps');
}

async function writeOtps(otps) {
    await writeCollection('otps', otps);
}

async function readSubscribers() {
    return readCollection('subscribers');
}

async function writeSubscribers(subscribers) {
    await writeCollection('subscribers', subscribers);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload));
}

function sendHtml(res, statusCode, html) {
    res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
}

function sendText(res, statusCode, content, contentType = 'text/plain; charset=utf-8') {
    res.writeHead(statusCode, { 'Content-Type': contentType });
    res.end(content);
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function normalizePhone(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 10) return `91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return digits;
    return digits;
}

function sendFile(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    fs.readFile(filePath, (error, content) => {
        if (error) {
            sendJson(res, 404, { error: 'File not found.' });
            return;
        }
        res.writeHead(200, { 'Content-Type': mimeType });
        res.end(content);
    });
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 1e6) {
                req.destroy();
                reject(new Error('Payload too large.'));
            }
        });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (error) {
                reject(new Error('Invalid JSON payload.'));
            }
        });
        req.on('error', reject);
    });
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return { salt, hash };
}

function verifyPassword(password, user) {
    const hash = crypto.scryptSync(password, user.passwordSalt, 64);
    const stored = Buffer.from(user.passwordHash, 'hex');
    return stored.length === hash.length && crypto.timingSafeEqual(stored, hash);
}

function createToken(user) {
    const payload = {
        sub: user.id,
        email: user.email,
        exp: Date.now() + 1000 * 60 * 60 * 24 * 30
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(encoded).digest('base64url');
    return `${encoded}.${signature}`;
}

function verifyToken(token) {
    if (!token || !token.includes('.')) return null;
    const [encoded, signature] = token.split('.');
    const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(encoded).digest('base64url');
    if (signature !== expected) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
}

async function getAuthUser(req) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const payload = verifyToken(token);
    if (!payload) return null;
    const users = await readUsers();
    return users.find(user => user.id === payload.sub) || null;
}

function sanitizeUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isAdmin: Boolean(ADMIN_EMAIL) && user.email === ADMIN_EMAIL
    };
}

function buildOrderRecord({ user, customer, pricedCart, subtotal, coupon, total, paymentMethod, paymentStatus, orderStatus = 'pending', trackingId = '', courierName = '', razorpayOrderId = '', razorpayPaymentId = '', depositAmount = 0, balanceDue = 0, deliveryCharge = 0, gstTotal = 0, gstBreakdown = null }) {
    return {
        id: crypto.randomUUID(),
        userId: user.id,
        customerName: customer.name,
        customerEmail: customer.email || user.email,
        customerPhone: customer.phone || user.phone,
        shippingAddress: {
            address: customer.address,
            city: customer.city,
            state: customer.state,
            pin: customer.pin
        },
        items: pricedCart,
        subtotal,
        discount: coupon ? coupon.discountAmount : 0,
        couponCode: coupon ? coupon.code : '',
        deliveryCharge,
        gstTotal,
        gstBreakdown,
        total,
        depositAmount,
        balanceDue,
        paymentMethod,
        paymentStatus,
        orderStatus,
        trackingId,
        courierName,
        razorpayOrderId,
        razorpayPaymentId,
        createdAt: new Date().toISOString()
    };
}

async function getAdminUser(req) {
    const authUser = await getAuthUser(req);
    if (!authUser) return null;
    return Boolean(ADMIN_EMAIL) && authUser.email === ADMIN_EMAIL ? authUser : null;
}

async function getOrderById(orderId) {
    const orders = await readOrders();
    return orders.find(order => order.id === orderId) || null;
}

function canAccessOrder(user, order) {
    if (!user || !order) return false;
    const isAdmin = Boolean(ADMIN_EMAIL) && user.email === ADMIN_EMAIL;
    return isAdmin || order.userId === user.id;
}

function currency(amount) {
    return Number(amount || 0).toLocaleString('en-IN');
}

function csvEscape(value) {
    const stringValue = String(value ?? '');
    return `"${stringValue.replace(/"/g, '""')}"`;
}

function getOtpDeliveryMode() {
    if (OTP_PROVIDER === 'msg91' && MSG91_AUTH_KEY && MSG91_TEMPLATE_ID) {
        return 'sms';
    }
    return 'preview';
}

async function sendOtpMessage({ phone, otp }) {
    if (getOtpDeliveryMode() !== 'sms') {
        return { mode: 'preview', previewOtp: otp };
    }

    const mobile = normalizePhone(phone);
    if (!mobile) {
        throw new Error('A valid phone number is required for SMS OTP delivery.');
    }

    const payload = {
        template_id: MSG91_TEMPLATE_ID,
        short_url: '0',
        recipients: [
            {
                mobiles: mobile,
                otp
            }
        ]
    };

    if (MSG91_SENDER_ID) payload.sender = MSG91_SENDER_ID;
    if (MSG91_ROUTE) payload.route = MSG91_ROUTE;

    const response = await fetch('https://control.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: {
            authkey: MSG91_AUTH_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    let data = {};
    try {
        data = responseText ? JSON.parse(responseText) : {};
    } catch (error) {
        data = {};
    }

    if (!response.ok) {
        throw new Error(data.message || data.error || 'Unable to send OTP SMS right now.');
    }

    return { mode: 'sms' };
}

function buildAdminStats(orders) {
    return {
        totalOrders: orders.length,
        pendingOrders: orders.filter(order => (order.orderStatus || 'pending') === 'pending').length,
        shippedOrders: orders.filter(order => order.orderStatus === 'shipped').length,
        deliveredOrders: orders.filter(order => order.orderStatus === 'delivered').length,
        totalRevenue: orders
            .filter(order => order.paymentStatus === 'paid' || order.paymentStatus === 'partial-paid' || order.paymentMethod === 'COD')
            .reduce((sum, order) => sum + Number(order.total || 0), 0)
    };
}

function buildOrdersCsv(orders) {
    const header = [
        'Order ID',
        'Created At',
        'Customer Name',
        'Customer Email',
        'Customer Phone',
        'Payment Method',
        'Payment Status',
        'Order Status',
        'Coupon Code',
        'Subtotal',
        'Discount',
        'Total',
        'Items'
    ];
    const lines = orders.map(order => [
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
    ].map(csvEscape).join(','));
    return [header.map(csvEscape).join(','), ...lines].join('\n');
}

function buildSubscribersCsv(subscribers) {
    const header = ['Subscriber ID', 'Email', 'Created At'];
    const lines = subscribers.map(subscriber => [
        subscriber.id,
        subscriber.email,
        subscriber.createdAt
    ].map(csvEscape).join(','));
    return [header.map(csvEscape).join(','), ...lines].join('\n');
}

function buildOrderDocumentHtml(order, type) {
    const documentTitle = type === 'packing-slip' ? 'Packing Slip' : 'Invoice';
    const address = order.shippingAddress || {};
    const paymentLine = `${order.paymentMethod} · ${order.paymentStatus}`;
    const trackingLine = [
        order.courierName ? `<div class="summary-line"><span>Courier</span><strong>${escapeHtml(order.courierName)}</strong></div>` : '',
        order.trackingId ? `<div class="summary-line"><span>Tracking ID</span><strong>${escapeHtml(order.trackingId)}</strong></div>` : ''
    ].join('');
    const summaryExtra = type === 'packing-slip'
        ? `<div class="summary-line"><span>Order Status</span><strong>${escapeHtml(order.orderStatus || 'pending')}</strong></div>${trackingLine}`
        : `${order.deliveryCharge ? `<div class="summary-line"><span>Delivery</span><strong>₹${currency(order.deliveryCharge)}</strong></div>` : ''}
           ${order.gstBreakdown?.igst ? `<div class="summary-line"><span>IGST</span><strong>₹${currency(order.gstBreakdown.igst)}</strong></div>` : `<div class="summary-line"><span>CGST</span><strong>₹${currency(order.gstBreakdown?.cgst || 0)}</strong></div><div class="summary-line"><span>SGST</span><strong>₹${currency(order.gstBreakdown?.sgst || 0)}</strong></div>`}
           <div class="summary-line"><span>Discount</span><strong>₹${currency(order.discount)}</strong></div>
           ${trackingLine}
           <div class="summary-line total"><span>Total</span><strong>₹${currency(order.total)}</strong></div>`;
    const itemHeader = type === 'packing-slip'
        ? '<tr><th>Item</th><th>Size</th><th>Qty</th></tr>'
        : '<tr><th>Item</th><th>Size</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>';
    const rows = order.items.map(item => type === 'packing-slip'
        ? `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.size)}</td><td>${escapeHtml(item.qty)}</td></tr>`
        : `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.size)}</td><td>${escapeHtml(item.qty)}</td><td>₹${currency(item.unitPrice)}</td><td>₹${currency(item.lineTotal)}</td></tr>`
    ).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(documentTitle)} ${escapeHtml(order.id)}</title>
    <style>
        body { font-family: Arial, sans-serif; color:#162742; margin:0; background:#eef3f9; }
        .sheet { max-width:900px; margin:24px auto; background:#fff; border:1px solid #d6e1ee; padding:32px; box-shadow:0 18px 50px rgba(17,34,55,0.08); }
        .top { display:flex; justify-content:space-between; gap:24px; margin-bottom:28px; }
        .brand h1 { margin:0; font-size:30px; color:#162742; }
        .brand p, .meta p { margin:6px 0; color:#53657e; line-height:1.5; }
        .section { margin-top:24px; }
        .section h2 { font-size:14px; text-transform:uppercase; letter-spacing:1.5px; color:#23415f; margin:0 0 10px; }
        .grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
        .card { border:1px solid #dbe5f0; background:#f8fbff; padding:16px; }
        table { width:100%; border-collapse:collapse; margin-top:12px; }
        th, td { border:1px solid #dde6f0; padding:10px; text-align:left; font-size:14px; }
        th { background:#edf4fb; color:#23415f; }
        .summary { margin-top:20px; margin-left:auto; max-width:320px; }
        .summary-line { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #e0e8f1; }
        .summary-line.total { font-size:18px; font-weight:700; border-bottom:none; color:#162742; }
        .footer { margin-top:28px; color:#53657e; font-size:13px; line-height:1.6; }
        @media print { body { background:#fff; } .sheet { margin:0; border:none; box-shadow:none; } }
    </style>
</head>
<body>
    <div class="sheet">
        <div class="top">
            <div class="brand">
                <h1>Ruh Imperium</h1>
                <p>Pure Indian Fragrances · Since 1973</p>
                <p>Kannauj, Uttar Pradesh</p>
                <p>+91 97858 54770 · ramjiattarwalaa@gmail.com</p>
            </div>
            <div class="meta">
                <p><strong>${escapeHtml(documentTitle)}</strong></p>
                <p>Order ID: ${escapeHtml(order.id)}</p>
                <p>Date: ${escapeHtml(new Date(order.createdAt).toLocaleString('en-IN'))}</p>
                <p>Payment: ${escapeHtml(paymentLine)}</p>
            </div>
        </div>

        <div class="grid">
            <div class="card">
                <h2>Bill To</h2>
                <p><strong>${escapeHtml(order.customerName)}</strong></p>
                <p>${escapeHtml(order.customerEmail)}</p>
                <p>${escapeHtml(order.customerPhone)}</p>
            </div>
            <div class="card">
                <h2>Ship To</h2>
                <p>${escapeHtml(address.address)}</p>
                <p>${escapeHtml(address.city)}, ${escapeHtml(address.state)} - ${escapeHtml(address.pin)}</p>
                <p>Order Status: ${escapeHtml(order.orderStatus || 'pending')}</p>
                ${order.courierName ? `<p>Courier: ${escapeHtml(order.courierName)}</p>` : ''}
                ${order.trackingId ? `<p>Tracking ID: ${escapeHtml(order.trackingId)}</p>` : ''}
            </div>
        </div>

        <div class="section">
            <h2>${escapeHtml(documentTitle)} Items</h2>
            <table>
                <thead>${itemHeader}</thead>
                <tbody>${rows}</tbody>
            </table>
        </div>

        <div class="summary">
            <div class="summary-line"><span>Subtotal</span><strong>₹${currency(order.subtotal)}</strong></div>
            ${type === 'packing-slip' ? '' : `<div class="summary-line"><span>Coupon</span><strong>${escapeHtml(order.couponCode || 'None')}</strong></div>`}
            ${summaryExtra}
        </div>

        <div class="footer">
            <p>${type === 'packing-slip' ? 'Use this sheet for fulfillment and packaging.' : 'Thank you for shopping with Ruh Imperium.'}</p>
        </div>
    </div>
</body>
</html>`;
}

// CART PRICING SETUP
function buildPricedCart(cart) {
    if (!Array.isArray(cart) || cart.length === 0) throw new Error('Your cart is empty.');
    return cart.map(item => {
        const product = productCatalog.find(entry => entry.id === item.id);
        if (!product) throw new Error('One or more cart items are invalid.');
        const quantity = Number(item.qty || 0);
        if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Invalid quantity in cart.');
        const size = product.sizes.includes(item.size) ? item.size : product.sizes[0];
        return {
            id: product.id,
            name: product.name,
            size,
            qty: quantity,
            unitPrice: product.price,
            lineTotal: product.price * quantity,
            gstRate: Number(product.gstRate || CATEGORY_GST_RATES[product.cat] || 18)
        };
    });
}

function calculateSubtotal(pricedCart) {
    return pricedCart.reduce((sum, item) => sum + item.lineTotal, 0);
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

// GST AND DELIVERY CALCULATION SETUP
function calculatePricing(pricedCart, coupon, customer = {}) {
    const subtotal = calculateSubtotal(pricedCart);
    const discount = coupon ? coupon.discountAmount : 0;
    const discountedSubtotal = Math.max(subtotal - discount, 0);
    const deliveryCharge = calculateDeliveryCharge(customer.state, customer.pin, discountedSubtotal);
    const gstBase = pricedCart.reduce((sum, item) => {
        const lineDiscount = subtotal ? Math.round((item.lineTotal / subtotal) * discount) : 0;
        const taxableLine = Math.max(item.lineTotal - lineDiscount, 0);
        return sum + Math.round(taxableLine * (Number(item.gstRate || 0) / 100));
    }, 0);
    const intrastate = String(customer.state || '').trim().toLowerCase() === ORIGIN_STATE.toLowerCase();
    const gstBreakdown = intrastate
        ? { cgst: Math.round(gstBase / 2), sgst: gstBase - Math.round(gstBase / 2), igst: 0 }
        : { cgst: 0, sgst: 0, igst: gstBase };
    return {
        subtotal,
        discount,
        deliveryCharge,
        gstTotal: gstBase,
        gstBreakdown,
        total: discountedSubtotal + deliveryCharge + gstBase
    };
}

// COUPON VALIDATION SETUP
function validateCoupon(code, subtotal) {
    const normalized = String(code || '').trim().toUpperCase();
    const coupon = coupons[normalized];
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
    return {
        code: normalized,
        label: coupon.label,
        type: coupon.type,
        value: coupon.value,
        expiresAt: coupon.expiresAt || '',
        discountAmount
    };
}

// RAZORPAY PAYMENT ORDER SETUP
async function createRazorpayOrder(amount, receipt, notes) {
    const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
            Authorization: `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            amount,
            currency: 'INR',
            receipt,
            notes
        })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.description || 'Unable to create Razorpay order.');
    return data;
}

// API ROUTES SETUP
async function handleApi(req, res, pathname, url) {
    if (req.method === 'GET' && pathname === '/api/health') {
        sendJson(res, 200, {
            ok: true,
            timestamp: new Date().toISOString(),
            storage: MONGODB_ENABLED ? 'mongodb' : REMOTE_DB_ENABLED ? 'supabase' : 'sqlite',
            paymentReady: Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET),
            adminReady: Boolean(ADMIN_EMAIL)
        });
        return;
    }

    if (req.method === 'GET' && pathname === '/api/config') {
        const razorpayConfigured = Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);
        const authConfigured = Boolean(TOKEN_SECRET && TOKEN_SECRET !== 'change-this-auth-secret');
        const adminConfigured = Boolean(ADMIN_EMAIL);
        const paymentEnabled = razorpayConfigured && authConfigured;
        const paymentReason = !razorpayConfigured
            ? 'Razorpay keys are missing on the server.'
            : !authConfigured
                ? 'Auth secret is missing on the server.'
                : '';
        sendJson(res, 200, {
            backendReady: true,
            razorpayKeyId: RAZORPAY_KEY_ID,
            adminEnabled: Boolean(ADMIN_EMAIL),
            adminEmail: ADMIN_EMAIL,
            otpDelivery: getOtpDeliveryMode(),
            paymentEnabled,
            paymentReason,
            health: {
                storage: MONGODB_ENABLED ? 'mongodb' : REMOTE_DB_ENABLED ? 'supabase' : 'sqlite',
                hostedDatabaseConfigured: REMOTE_DB_ENABLED,
                mongodbConfigured: MONGODB_ENABLED,
                analyticsConfigured: Boolean(GOOGLE_ANALYTICS_ID),
                searchConsoleConfigured: Boolean(GOOGLE_SITE_VERIFICATION),
                recaptchaConfigured: Boolean(RECAPTCHA_SITE_KEY && RECAPTCHA_SECRET_KEY),
                emailConfigured: Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS),
                razorpayConfigured,
                authConfigured,
                adminConfigured,
                paymentEnabled,
                paymentReason
            }
        });
        return;
    }

    if (req.method === 'POST' && pathname === '/api/auth/signup') {
        const body = await readBody(req);
        const name = String(body.name || '').trim();
        const email = String(body.email || '').trim().toLowerCase();
        const phone = String(body.phone || '').trim();
        const password = String(body.password || '');
        if (!name || !email || !phone || password.length < 6) {
            sendJson(res, 400, { error: 'Name, email, phone, and a 6+ character password are required.' });
            return;
        }
        const users = await readUsers();
        if (users.some(user => user.email === email)) {
            sendJson(res, 409, { error: 'An account with this email already exists.' });
            return;
        }
        const passwordData = hashPassword(password);
        const user = {
            id: crypto.randomUUID(),
            name,
            email,
            phone,
            passwordSalt: passwordData.salt,
            passwordHash: passwordData.hash,
            createdAt: new Date().toISOString()
        };
        users.push(user);
        await writeUsers(users);
        sendJson(res, 201, {
            user: sanitizeUser(user),
            token: createToken(user)
        });
        return;
    }

    if (req.method === 'POST' && pathname === '/api/auth/login') {
        const body = await readBody(req);
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        if (!email || !password) {
            sendJson(res, 400, { error: 'Email and password are required.' });
            return;
        }
        const users = await readUsers();
        const user = users.find(entry => entry.email === email);
        if (!user || !verifyPassword(password, user)) {
            sendJson(res, 401, { error: 'Invalid email or password.' });
            return;
        }
        sendJson(res, 200, {
            user: sanitizeUser(user),
            token: createToken(user)
        });
        return;
    }

    if (req.method === 'POST' && pathname === '/api/auth/request-otp') {
        const body = await readBody(req);
        const email = String(body.email || '').trim().toLowerCase();
        const phone = String(body.phone || '').trim();
        if (!email && !phone) {
            sendJson(res, 400, { error: 'Email or phone is required.' });
            return;
        }
        const users = await readUsers();
        const user = users.find(entry => (email && entry.email === email) || (phone && entry.phone === phone));
        if (!user) {
            sendJson(res, 404, { error: 'No account found for that email or phone.' });
            return;
        }
        const code = String(Math.floor(1000 + Math.random() * 9000));
        const otps = (await readOtps()).filter(entry => entry.userId !== user.id && entry.expiresAt > Date.now());
        otps.push({
            userId: user.id,
            purpose: 'login',
            email: user.email,
            phone: user.phone,
            codeHash: crypto.createHash('sha256').update(code).digest('hex'),
            expiresAt: Date.now() + 5 * 60 * 1000
        });
        await writeOtps(otps);
        const delivery = await sendOtpMessage({ phone: user.phone || phone, otp: code });
        sendJson(res, 200, {
            message: delivery.mode === 'sms'
                ? `OTP sent to ${user.phone || phone}.`
                : `OTP generated for ${email || phone}. SMS is not configured yet.`,
            identifier: email || phone,
            delivery: delivery.mode,
            previewOtp: delivery.previewOtp || ''
        });
        return;
    }

    if (req.method === 'POST' && pathname === '/api/auth/verify-otp') {
        const body = await readBody(req);
        const email = String(body.email || '').trim().toLowerCase();
        const phone = String(body.phone || '').trim();
        const otp = String(body.otp || '').trim();
        if ((!email && !phone) || !otp) {
            sendJson(res, 400, { error: 'Email or phone and OTP are required.' });
            return;
        }
        const users = await readUsers();
        const user = users.find(entry => (email && entry.email === email) || (phone && entry.phone === phone));
        if (!user) {
            sendJson(res, 404, { error: 'Account not found.' });
            return;
        }
        const otps = await readOtps();
        const matchingOtp = otps.find(entry => entry.userId === user.id && entry.purpose === 'login' && entry.expiresAt > Date.now());
        if (!matchingOtp) {
            sendJson(res, 400, { error: 'OTP expired. Please request a new one.' });
            return;
        }
        const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
        if (matchingOtp.codeHash !== otpHash) {
            sendJson(res, 400, { error: 'Invalid OTP.' });
            return;
        }
        await writeOtps(otps.filter(entry => entry.userId !== user.id));
        sendJson(res, 200, {
            user: sanitizeUser(user),
            token: createToken(user)
        });
        return;
    }

    if (req.method === 'POST' && pathname === '/api/orders/request-otp') {
        const authUser = await getAuthUser(req);
        if (!authUser) {
            sendJson(res, 401, { error: 'Please sign in again before requesting order OTP.' });
            return;
        }
        const body = await readBody(req);
        const email = String(body.email || authUser.email || '').trim().toLowerCase();
        const phone = String(body.phone || authUser.phone || '').trim();
        if (!email && !phone) {
            sendJson(res, 400, { error: 'Email or phone is required.' });
            return;
        }
        const code = String(Math.floor(1000 + Math.random() * 9000));
        const otps = (await readOtps()).filter(entry => !(entry.userId === authUser.id && entry.purpose === 'order') && entry.expiresAt > Date.now());
        otps.push({
            userId: authUser.id,
            purpose: 'order',
            email,
            phone,
            codeHash: crypto.createHash('sha256').update(code).digest('hex'),
            expiresAt: Date.now() + 5 * 60 * 1000
        });
        await writeOtps(otps);
        const delivery = await sendOtpMessage({ phone, otp: code });
        sendJson(res, 200, {
            message: delivery.mode === 'sms'
                ? `Order OTP sent to ${phone || email}.`
                : `Order OTP generated for ${phone || email}. SMS is not configured yet.`,
            identifier: phone || email,
            delivery: delivery.mode,
            previewOtp: delivery.previewOtp || ''
        });
        return;
    }

    if (req.method === 'POST' && pathname === '/api/orders/verify-otp') {
        const authUser = await getAuthUser(req);
        if (!authUser) {
            sendJson(res, 401, { error: 'Please sign in again before verifying order OTP.' });
            return;
        }
        const body = await readBody(req);
        const email = String(body.email || '').trim().toLowerCase();
        const phone = String(body.phone || '').trim();
        const otp = String(body.otp || '').trim();
        if ((!email && !phone) || !otp) {
            sendJson(res, 400, { error: 'Email or phone and OTP are required.' });
            return;
        }
        const otps = await readOtps();
        const matchingOtp = otps.find(entry =>
            entry.userId === authUser.id &&
            entry.purpose === 'order' &&
            entry.expiresAt > Date.now() &&
            ((email && entry.email === email) || (phone && entry.phone === phone))
        );
        if (!matchingOtp) {
            sendJson(res, 400, { error: 'Order OTP expired. Please request a new one.' });
            return;
        }
        const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
        if (matchingOtp.codeHash !== otpHash) {
            sendJson(res, 400, { error: 'Invalid order OTP.' });
            return;
        }
        await writeOtps(otps.filter(entry => !(entry.userId === authUser.id && entry.purpose === 'order')));
        sendJson(res, 200, {
            verified: true,
            identifier: phone || email
        });
        return;
    }

    if (req.method === 'POST' && pathname === '/api/coupons/validate') {
        const body = await readBody(req);
        const pricedCart = buildPricedCart(body.cart);
        const subtotal = calculateSubtotal(pricedCart);
        const coupon = validateCoupon(body.code, subtotal);
        const pricing = calculatePricing(pricedCart, coupon, body.customer || {});
        sendJson(res, 200, {
            coupon: {
                ...coupon,
                subtotal: pricing.subtotal,
                finalTotal: pricing.total,
                deliveryCharge: pricing.deliveryCharge,
                gstTotal: pricing.gstTotal,
                gstBreakdown: pricing.gstBreakdown
            },
            pricing
        });
        return;
    }

    if (req.method === 'POST' && pathname === '/api/newsletter/subscribe') {
        const body = await readBody(req);
        const email = String(body.email || '').trim().toLowerCase();
        if (!isValidEmail(email)) {
            sendJson(res, 400, { error: 'Please enter a valid email address.' });
            return;
        }
        const subscribers = await readSubscribers();
        const existing = subscribers.find(entry => entry.email === email);
        if (existing) {
            sendJson(res, 200, { subscribed: true, alreadySubscribed: true, email });
            return;
        }
        subscribers.push({
            id: crypto.randomUUID(),
            email,
            createdAt: new Date().toISOString()
        });
        await writeSubscribers(subscribers);
        sendJson(res, 201, { subscribed: true, email });
        return;
    }

    if (req.method === 'POST' && pathname === '/api/payments/razorpay/order') {
        const authUser = await getAuthUser(req);
        if (!authUser) {
            sendJson(res, 401, { error: 'Please sign in again before payment.' });
            return;
        }
        if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
            sendJson(res, 500, { error: 'Razorpay keys are missing on the server.' });
            return;
        }
        const body = await readBody(req);
        const pricedCart = buildPricedCart(body.cart);
        const subtotal = calculateSubtotal(pricedCart);
        const coupon = body.couponCode ? validateCoupon(body.couponCode, subtotal) : null;
        const pricing = calculatePricing(pricedCart, coupon, body.customer || {});
        const total = pricing.total;
        const paymentPlan = String(body.paymentPlan || 'full').trim().toLowerCase() === 'partial-cod' ? 'partial-cod' : 'full';
        const depositAmount = paymentPlan === 'partial-cod'
            ? Math.max(1, Math.round(total * (PARTIAL_COD_DEPOSIT_PERCENT / 100)))
            : total;
        const balanceDue = Math.max(total - depositAmount, 0);
        const receipt = `ruh_${Date.now()}`;
        const order = await createRazorpayOrder(depositAmount * 100, receipt, {
            customerEmail: authUser.email,
            customerPhone: authUser.phone,
            coupon: coupon ? coupon.code : 'None',
            paymentPlan
        });
        const orders = await readOrders();
        orders.push(buildOrderRecord({
            user: authUser,
            customer: body.customer || {},
            pricedCart,
            subtotal,
            coupon,
            total,
            deliveryCharge: pricing.deliveryCharge,
            gstTotal: pricing.gstTotal,
            gstBreakdown: pricing.gstBreakdown,
            depositAmount,
            balanceDue,
            paymentMethod: paymentPlan === 'partial-cod' ? 'Partial COD' : 'Razorpay',
            paymentStatus: 'created',
            orderStatus: 'pending',
            razorpayOrderId: order.id
        }));
        await writeOrders(orders);
        sendJson(res, 200, {
            keyId: RAZORPAY_KEY_ID,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency
        });
        return;
    }

    if (req.method === 'POST' && pathname === '/api/payments/razorpay/verify') {
        const authUser = await getAuthUser(req);
        if (!authUser) {
            sendJson(res, 401, { error: 'Please sign in again before payment verification.' });
            return;
        }
        if (!RAZORPAY_KEY_SECRET) {
            sendJson(res, 500, { error: 'Razorpay key secret is missing on the server.' });
            return;
        }
        const body = await readBody(req);
        const expected = crypto
            .createHmac('sha256', RAZORPAY_KEY_SECRET)
            .update(`${body.orderId}|${body.paymentId}`)
            .digest('hex');
        if (expected !== body.signature) {
            sendJson(res, 400, { error: 'Payment signature verification failed.' });
            return;
        }
        const orders = await readOrders();
        const order = orders.find(entry => entry.razorpayOrderId === body.orderId && entry.userId === authUser.id);
        if (order) {
            order.paymentStatus = order.paymentMethod === 'Partial COD' ? 'partial-paid' : 'paid';
            order.razorpayPaymentId = body.paymentId;
            order.paidAt = new Date().toISOString();
            await writeOrders(orders);
        }
        sendJson(res, 200, { verified: true });
        return;
    }

    if (req.method === 'POST' && pathname === '/api/orders/cod') {
        const authUser = await getAuthUser(req);
        if (!authUser) {
            sendJson(res, 401, { error: 'Please sign in again before placing the order.' });
            return;
        }
        const body = await readBody(req);
        const pricedCart = buildPricedCart(body.cart);
        const subtotal = calculateSubtotal(pricedCart);
        const coupon = body.couponCode ? validateCoupon(body.couponCode, subtotal) : null;
        const pricing = calculatePricing(pricedCart, coupon, body.customer || {});
        const total = pricing.total;
        const orders = await readOrders();
        const order = buildOrderRecord({
            user: authUser,
            customer: body.customer || {},
            pricedCart,
            subtotal,
            coupon,
            total,
            deliveryCharge: pricing.deliveryCharge,
            gstTotal: pricing.gstTotal,
            gstBreakdown: pricing.gstBreakdown,
            paymentMethod: 'COD',
            paymentStatus: 'pending',
            orderStatus: 'pending'
        });
        orders.push(order);
        await writeOrders(orders);
        sendJson(res, 201, { orderId: order.id });
        return;
    }

    if (req.method === 'GET' && pathname === '/api/orders') {
        const authUser = await getAuthUser(req);
        if (!authUser) {
            sendJson(res, 401, { error: 'Please sign in again to view your orders.' });
            return;
        }
        const orders = (await readOrders())
            .filter(order => order.userId === authUser.id)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        sendJson(res, 200, { orders });
        return;
    }

    if (req.method === 'GET' && pathname.startsWith('/api/orders/') && pathname.endsWith('/document')) {
        const authUser = await getAuthUser(req);
        if (!authUser) {
            sendJson(res, 401, { error: 'Please sign in again to view this document.' });
            return;
        }
        const parts = pathname.split('/');
        const orderId = parts[3];
        const order = await getOrderById(orderId);
        if (!canAccessOrder(authUser, order)) {
            sendJson(res, 403, { error: 'You do not have access to this order document.' });
            return;
        }
        const type = url.searchParams.get('type') === 'packing-slip' ? 'packing-slip' : 'invoice';
        sendHtml(res, 200, buildOrderDocumentHtml(order, type));
        return;
    }

    if (req.method === 'GET' && pathname === '/api/admin/orders') {
        const adminUser = await getAdminUser(req);
        if (!adminUser) {
            sendJson(res, 403, { error: 'Admin access required.' });
            return;
        }
        const orders = (await readOrders()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        sendJson(res, 200, { orders });
        return;
    }

    if (req.method === 'GET' && pathname === '/api/admin/stats') {
        const adminUser = await getAdminUser(req);
        if (!adminUser) {
            sendJson(res, 403, { error: 'Admin access required.' });
            return;
        }
        const orders = await readOrders();
        sendJson(res, 200, { stats: buildAdminStats(orders) });
        return;
    }

    if (req.method === 'GET' && pathname === '/api/admin/orders/export.csv') {
        const adminUser = await getAdminUser(req);
        if (!adminUser) {
            sendJson(res, 403, { error: 'Admin access required.' });
            return;
        }
        const orders = (await readOrders()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        sendText(res, 200, buildOrdersCsv(orders), 'text/csv; charset=utf-8');
        return;
    }

    if (req.method === 'GET' && pathname === '/api/admin/subscribers') {
        const adminUser = await getAdminUser(req);
        if (!adminUser) {
            sendJson(res, 403, { error: 'Admin access required.' });
            return;
        }
        const subscribers = (await readSubscribers()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        sendJson(res, 200, { subscribers });
        return;
    }

    if (req.method === 'GET' && pathname === '/api/admin/subscribers/export.csv') {
        const adminUser = await getAdminUser(req);
        if (!adminUser) {
            sendJson(res, 403, { error: 'Admin access required.' });
            return;
        }
        const subscribers = (await readSubscribers()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        sendText(res, 200, buildSubscribersCsv(subscribers), 'text/csv; charset=utf-8');
        return;
    }

    if (req.method === 'DELETE' && pathname.startsWith('/api/admin/subscribers/')) {
        const adminUser = await getAdminUser(req);
        if (!adminUser) {
            sendJson(res, 403, { error: 'Admin access required.' });
            return;
        }
        const parts = pathname.split('/');
        const subscriberId = parts[4];
        const subscribers = await readSubscribers();
        const nextSubscribers = subscribers.filter(subscriber => subscriber.id !== subscriberId);
        if (nextSubscribers.length === subscribers.length) {
            sendJson(res, 404, { error: 'Subscriber not found.' });
            return;
        }
        await writeSubscribers(nextSubscribers);
        sendJson(res, 200, { removed: true, subscriberId });
        return;
    }

    if (req.method === 'PATCH' && pathname.startsWith('/api/admin/orders/') && pathname.endsWith('/status')) {
        const adminUser = await getAdminUser(req);
        if (!adminUser) {
            sendJson(res, 403, { error: 'Admin access required.' });
            return;
        }
        const parts = pathname.split('/');
        const orderId = parts[4];
        const body = await readBody(req);
        const nextStatus = String(body.orderStatus || '').trim().toLowerCase();
        const nextTrackingId = String(body.trackingId || '').trim();
        const nextCourierName = String(body.courierName || '').trim();
        const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered'];
        if (!nextStatus && !nextTrackingId && !nextCourierName) {
            sendJson(res, 400, { error: 'Order status, courier, or tracking ID is required.' });
            return;
        }
        if (nextStatus && !validStatuses.includes(nextStatus)) {
            sendJson(res, 400, { error: 'Invalid order status.' });
            return;
        }
        const orders = await readOrders();
        const order = orders.find(entry => entry.id === orderId);
        if (!order) {
            sendJson(res, 404, { error: 'Order not found.' });
            return;
        }
        if (nextStatus) order.orderStatus = nextStatus;
        order.trackingId = nextTrackingId;
        order.courierName = nextCourierName;
        order.updatedAt = new Date().toISOString();
        await writeOrders(orders);
        sendJson(res, 200, { order });
        return;
    }

    sendJson(res, 404, { error: 'API route not found.' });
}

const server = http.createServer(async (req, res) => {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathname = decodeURIComponent(url.pathname);

        if (pathname.startsWith('/api/')) {
            await handleApi(req, res, pathname, url);
            return;
        }

        const requestedPath = pathname === '/' ? '/index.html' : pathname;
        const normalizedPath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, '');
        const filePath = path.join(ROOT, normalizedPath);
        if (!filePath.startsWith(ROOT)) {
            sendJson(res, 403, { error: 'Forbidden.' });
            return;
        }
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
            sendJson(res, 404, { error: 'File not found.' });
            return;
        }
        sendFile(res, filePath);
    } catch (error) {
        sendJson(res, 500, { error: error.message || 'Internal server error.' });
    }
});

module.exports = {
    server,
    handleApi,
    buildPricedCart,
    calculateSubtotal,
    validateCoupon,
    buildOrderRecord,
    buildOrderDocumentHtml,
    buildAdminStats,
    buildOrdersCsv,
    sanitizeUser,
    createToken,
    verifyToken
};

if (require.main === module && process.env.SKIP_LISTEN !== '1') {
    server.listen(PORT, () => {
        console.log(`Ruh Imperium server running on http://localhost:${PORT}`);
    });
}
