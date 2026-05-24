import { Router } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { logger } from "../lib/logger";

const _require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// process.cwd() is artifacts/api-server/ when run via pnpm scripts
const ARTIFACT_ROOT = path.resolve(process.cwd());

const router = Router();

// ── Config ──────────────────────────────────────────────────────────────────
const TOKEN_SECRET = process.env.AUTH_SECRET || "change-this-auth-secret";
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
const RECAPTCHA_SITE_KEY = String(process.env.RECAPTCHA_SITE_KEY || "").trim();
const RECAPTCHA_SECRET_KEY = String(process.env.RECAPTCHA_SECRET_KEY || "").trim();
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim();
const OPENAI_MODEL = String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
const SMTP_HOST = String(process.env.SMTP_HOST || "").trim();
const SMTP_PORT = String(process.env.SMTP_PORT || "").trim();
const SMTP_USER = String(process.env.SMTP_USER || "").trim();
const SMTP_PASS = String(process.env.SMTP_PASS || "").trim();
const SMTP_FROM = String(process.env.SMTP_FROM || SMTP_USER || "").trim();
const APP_BASE_URL = String(process.env.APP_BASE_URL || "").trim().replace(/\/$/, "");
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const OTP_PROVIDER = String(process.env.OTP_PROVIDER || "").trim().toLowerCase();
const MSG91_AUTH_KEY = String(process.env.MSG91_AUTH_KEY || "").trim();
const MSG91_TEMPLATE_ID = String(process.env.MSG91_TEMPLATE_ID || "").trim();
const MSG91_SENDER_ID = String(process.env.MSG91_SENDER_ID || "").trim();
const MSG91_ROUTE = String(process.env.MSG91_ROUTE || "4").trim();
const MONGODB_URI = String(process.env.MONGODB_URI || "").trim();
const MONGODB_DB_NAME = String(process.env.MONGODB_DB_NAME || "ruhImperium").trim();
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const MONGODB_ENABLED = Boolean(MONGODB_URI && MONGODB_DB_NAME);
const REMOTE_DB_ENABLED = MONGODB_ENABLED || Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const ORIGIN_STATE = "Uttar Pradesh";
const PARTIAL_COD_DEPOSIT_PERCENT = 20;
const REMOTE_STATES = new Set(["West Bengal", "Tamil Nadu", "Karnataka", "Maharashtra", "Other"]);

const CATEGORY_GST_RATES: Record<string, number> = {
  "Discovery Set": 12,
  "Ruh / Absolute Oil": 18,
  "Authentic Indian Attars": 18,
  "Next Gen Fragrances": 18,
  "Modern Attars": 18,
  "Eau De Parfum": 18,
};

const SHIPPING_PROVIDERS = [
  { id: "delhivery", label: "Delhivery" },
  { id: "ecom-express", label: "Ecom Express" },
  { id: "ekart", label: "Ekart" },
  { id: "xpressbees", label: "Xpressbees" },
  { id: "dtdc", label: "DTDC" },
  { id: "blue-dart", label: "Blue Dart" },
  { id: "india-post", label: "India Post / Speed Post" },
];

const coupons: Record<string, { type: string; value: number; label: string; expiresAt?: string; minOrder?: number }> = {
  BUY2: { type: "percent", value: 20, label: "Buy 2 Offer", expiresAt: "2027-03-31T23:59:59.000Z" },
  RAMJI20: { type: "percent", value: 20, label: "Ram Ji Signature Offer", expiresAt: "2027-03-31T23:59:59.000Z" },
  WELCOME10: { type: "percent", value: 10, label: "Welcome Offer", expiresAt: "2027-03-31T23:59:59.000Z" },
  ATTAR250: { type: "flat", value: 250, minOrder: 1500, label: "Flat Rs. 250 Off", expiresAt: "2027-03-31T23:59:59.000Z" },
  ADI50: { type: "percent", value: 50, label: "SPECIAL OFFER", expiresAt: "2026-05-31T23:59:59.000Z" },
};

// ── Data store ───────────────────────────────────────────────────────────────
const DATA_DIR = process.env.DATA_DIR || path.join(ARTIFACT_ROOT, "database", "data");
const DB_FILE = path.join(DATA_DIR, "ruh-imperium.sqlite");

let db: any = null;
let mongoClientPromise: Promise<any> | null = null;
let transporterPromise: Promise<any> | null = null;

function ensureDataStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function openDatabase() {
  // @ts-ignore
  const { DatabaseSync } = _require("node:sqlite");
  const database = new DatabaseSync(DB_FILE);
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  seedCollection(database, "users", path.join(DATA_DIR, "users.json"));
  seedCollection(database, "orders", path.join(DATA_DIR, "orders.json"));
  seedCollection(database, "otps", path.join(DATA_DIR, "otps.json"));
  seedCollection(database, "subscribers", path.join(DATA_DIR, "subscribers.json"));
  return database;
}

function seedCollection(database: any, key: string, legacyFile: string) {
  const existing = database.prepare("SELECT key FROM app_store WHERE key = ?").get(key);
  if (existing) return;
  let value: any[] = [];
  if (fs.existsSync(legacyFile)) {
    try { value = JSON.parse(fs.readFileSync(legacyFile, "utf8")); } catch { value = []; }
  }
  database.prepare("INSERT INTO app_store (key, value) VALUES (?, ?)").run(key, JSON.stringify(value));
}

if (!REMOTE_DB_ENABLED) {
  ensureDataStore();
  db = openDatabase();
}

function readCollectionLocal(key: string): any[] {
  const row = db.prepare("SELECT value FROM app_store WHERE key = ?").get(key);
  if (!row) return [];
  try { return JSON.parse(row.value); } catch { return []; }
}

function writeCollectionLocal(key: string, value: any[]) {
  db.prepare(`
    INSERT INTO app_store (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, JSON.stringify(value));
}

async function getMongoCollection() {
  if (!MONGODB_ENABLED) return null;
  if (!mongoClientPromise) {
    const { MongoClient } = await import("mongodb");
    mongoClientPromise = MongoClient.connect(MONGODB_URI, { maxPoolSize: 10 });
  }
  const client = await mongoClientPromise;
  const database = client.db(MONGODB_DB_NAME);
  const collection = database.collection("app_store");
  await collection.createIndex({ _id: 1 }, { unique: true });
  return collection;
}

async function readCollectionMongo(key: string): Promise<any[]> {
  const collection = await getMongoCollection();
  const document = await collection.findOne({ _id: key });
  if (!document) {
    await collection.updateOne({ _id: key }, { $setOnInsert: { value: [], updatedAt: new Date() } }, { upsert: true });
    return [];
  }
  return Array.isArray(document.value) ? document.value : [];
}

async function writeCollectionMongo(key: string, value: any[]) {
  const collection = await getMongoCollection();
  await collection.updateOne({ _id: key }, { $set: { value, updatedAt: new Date() } }, { upsert: true });
}

async function requestRemoteCollection(resourcePath: string, init: any = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${resourcePath}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation,resolution=merge-duplicates",
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || "Hosted database request failed.");
  }
  if (response.status === 204) return null;
  return response.json().catch(() => null);
}

async function readCollection(key: string): Promise<any[]> {
  if (MONGODB_ENABLED) return readCollectionMongo(key);
  if (!REMOTE_DB_ENABLED) return readCollectionLocal(key);
  const rows = await requestRemoteCollection(`app_store?key=eq.${encodeURIComponent(key)}&select=value&limit=1`, {
    method: "GET",
    headers: { Prefer: "return=representation" },
  });
  const value = Array.isArray(rows) && rows[0] ? rows[0].value : [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") { try { return JSON.parse(value); } catch { return []; } }
  return value && typeof value === "object" ? value : [];
}

async function writeCollection(key: string, value: any[]) {
  if (MONGODB_ENABLED) { await writeCollectionMongo(key, value); return; }
  if (!REMOTE_DB_ENABLED) { writeCollectionLocal(key, value); return; }
  await requestRemoteCollection("app_store?on_conflict=key", {
    method: "POST",
    body: JSON.stringify([{ key, value, updated_at: new Date().toISOString() }]),
  });
}

const readUsers = () => readCollection("users");
const writeUsers = (u: any[]) => writeCollection("users", u);
const readOrders = () => readCollection("orders");
const writeOrders = (o: any[]) => writeCollection("orders", o);
const readOtps = () => readCollection("otps");
const writeOtps = (o: any[]) => writeCollection("otps", o);
const readSubscribers = () => readCollection("subscribers");
const writeSubscribers = (s: any[]) => writeCollection("subscribers", s);

// ── Products ─────────────────────────────────────────────────────────────────
function loadProducts() {
  const dbDir = path.join(ARTIFACT_ROOT, "database");
  const file = fs.readFileSync(path.join(dbDir, "products.js"), "utf8");
  const context: any = { globalThis: {} };
  vm.createContext(context);
  vm.runInContext(`${file}\nglobalThis.__products = products;`, context);
  return context.globalThis.__products || [];
}

const productCatalog = loadProducts();

function normalizeCatalogProduct(product: any) {
  return {
    id: product.id, name: product.name, displayName: product.displayName || product.name,
    img: product.img, cat: product.cat, notes: product.notes, price: product.price,
    oldPrice: product.oldPrice || null, stars: product.stars, reviews: product.reviews,
    badge: product.badge || "", sizes: product.sizes || [], desc: product.desc, tags: product.tags || [],
  };
}

function productSearchBlob(product: any) {
  return [product.name, product.cat, product.notes, product.desc, ...(product.tags || [])].join(" ").toLowerCase();
}

function scoreProductForPrompt(product: any, prompt: string) {
  const text = String(prompt || "").toLowerCase();
  const blob = productSearchBlob(product);
  let score = 0;
  const directTerms = text.split(/[^a-z0-9]+/i).filter((t: string) => t.length > 2);
  directTerms.forEach((term: string) => { if (blob.includes(term)) score += 2; });
  const toneGroups = [
    { terms: ["fresh", "cool", "clean", "summer", "office", "light"], matches: ["fresh", "summer", "office", "khus"] },
    { terms: ["floral", "flower", "romantic", "rose", "jasmine"], matches: ["floral", "rose", "jasmine", "mogra", "gulab"] },
    { terms: ["woody", "earthy", "deep", "mitti", "rain", "sandal", "oud"], matches: ["woody", "earthy", "mitti", "oud"] },
    { terms: ["sweet", "vanilla", "caramel", "warm", "cozy"], matches: ["vanilla", "caramel", "eclair"] },
    { terms: ["gift", "gifting", "birthday", "wedding", "set"], matches: ["gifting", "festival", "discovery"] },
    { terms: ["party", "bold", "strong", "night", "date", "winter"], matches: ["party", "winter", "musk", "oud", "amber"] },
  ];
  toneGroups.forEach((group) => {
    if (group.terms.some((t) => text.includes(t))) {
      group.matches.forEach((m) => { if (blob.includes(m)) score += 4; });
    }
  });
  if (product.bestseller) score += 1;
  return score;
}

function getLocalScentMatches(prompt: string, limit = 4) {
  return productCatalog
    .map((p: any) => ({ product: p, score: scoreProductForPrompt(p, prompt) }))
    .sort((a: any, b: any) => b.score - a.score || b.product.stars - a.product.stars || a.product.price - b.product.price)
    .slice(0, limit)
    .map((e: any) => normalizeCatalogProduct(e.product));
}

function buildLocalScentReply(message: string, suggestions: any[]) {
  if (!suggestions.length) return "I could not find a perfect match yet. Try fresh, floral, woody, sweet, office, party, gifting, summer, or winter.";
  const tone = String(message || "").trim() || "your scent tone";
  const lines = suggestions.slice(0, 3).map((p: any) => `${p.name}: ${p.notes} profile, ${p.cat}, ₹${p.price}.`);
  return `For ${tone}, I would start with these Ruh Imperium picks:\n${lines.join("\n")}\nOpen any recommendation to compare notes, size, and price.`;
}

// ── Auth helpers ─────────────────────────────────────────────────────────────
function hashPassword(password: string, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}
function verifyPassword(password: string, user: any) {
  const hash = crypto.scryptSync(password, user.passwordSalt, 64);
  const stored = Buffer.from(user.passwordHash, "hex");
  return stored.length === hash.length && crypto.timingSafeEqual(stored, hash);
}
function createToken(user: any) {
  const payload = { sub: user.id, email: user.email, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", TOKEN_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}
function verifyToken(token: string) {
  if (!token || !token.includes(".")) return null;
  const [encoded, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", TOKEN_SECRET).update(encoded).digest("base64url");
  if (signature !== expected) return null;
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  if (!payload.exp || payload.exp < Date.now()) return null;
  return payload;
}
async function getAuthUser(req: any) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const payload = verifyToken(token);
  if (!payload) return null;
  const users = await readUsers();
  return users.find((u: any) => u.id === payload.sub) || null;
}
async function getAdminUser(req: any) {
  const authUser = await getAuthUser(req);
  if (!authUser) return null;
  return Boolean(ADMIN_EMAIL) && authUser.email === ADMIN_EMAIL ? authUser : null;
}
function sanitizeUser(user: any) {
  return { id: user.id, name: user.name, email: user.email, phone: user.phone, isAdmin: Boolean(ADMIN_EMAIL) && user.email === ADMIN_EMAIL };
}
function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}
function normalizePhone(phone: string) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
}
function getOtpDeliveryMode() {
  if (OTP_PROVIDER === "msg91" && MSG91_AUTH_KEY && MSG91_TEMPLATE_ID) return "sms";
  return "preview";
}

// ── Pricing ───────────────────────────────────────────────────────────────────
function buildPricedCart(cart: any[]) {
  if (!Array.isArray(cart) || cart.length === 0) throw new Error("Your cart is empty.");
  return cart.map((item) => {
    const product = productCatalog.find((p: any) => p.id === item.id);
    if (!product) throw new Error("One or more cart items are invalid.");
    const quantity = Number(item.qty || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Invalid quantity in cart.");
    const size = product.sizes.includes(item.size) ? item.size : product.sizes[0];
    return {
      id: product.id, name: product.name, size, qty: quantity,
      unitPrice: product.price, lineTotal: product.price * quantity,
      gstRate: Number(product.gstRate || CATEGORY_GST_RATES[product.cat] || 18),
    };
  });
}
function calculateSubtotal(pricedCart: any[]) {
  return pricedCart.reduce((sum, item) => sum + item.lineTotal, 0);
}
function calculateDeliveryCharge(state: string, pin: string, subtotal: number) {
  const normalizedState = String(state || "").trim();
  const normalizedPin = String(pin || "").trim();
  let extra = 0;
  if (REMOTE_STATES.has(normalizedState)) extra += 99;
  if (/^[78]/.test(normalizedPin)) extra += 40;
  if (subtotal >= 2499) extra = Math.max(extra - 40, 0);
  return extra;
}
function calculatePricing(pricedCart: any[], coupon: any, customer: any = {}) {
  const subtotal = calculateSubtotal(pricedCart);
  const discount = coupon ? coupon.discountAmount : 0;
  const discountedSubtotal = Math.max(subtotal - discount, 0);
  const deliveryCharge = calculateDeliveryCharge(customer.state, customer.pin, discountedSubtotal);
  const gstBase = pricedCart.reduce((sum, item) => {
    const lineDiscount = subtotal ? Math.round((item.lineTotal / subtotal) * discount) : 0;
    const taxableLine = Math.max(item.lineTotal - lineDiscount, 0);
    return sum + Math.round(taxableLine * (Number(item.gstRate || 0) / 100));
  }, 0);
  const intrastate = String(customer.state || "").trim().toLowerCase() === ORIGIN_STATE.toLowerCase();
  const gstBreakdown = intrastate
    ? { cgst: Math.round(gstBase / 2), sgst: gstBase - Math.round(gstBase / 2), igst: 0 }
    : { cgst: 0, sgst: 0, igst: gstBase };
  return { subtotal, discount, deliveryCharge, gstTotal: gstBase, gstBreakdown, total: discountedSubtotal + deliveryCharge + gstBase };
}
function validateCoupon(code: string, subtotal: number) {
  const normalized = String(code || "").trim().toUpperCase();
  const coupon = coupons[normalized];
  if (!coupon) throw new Error("Invalid coupon code.");
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) throw new Error("This coupon has expired.");
  if (coupon.minOrder && subtotal < coupon.minOrder) throw new Error(`Coupon works on orders above ₹${coupon.minOrder}.`);
  const discountAmount = coupon.type === "percent" ? Math.round(subtotal * (coupon.value / 100)) : Math.min(coupon.value, subtotal);
  return { code: normalized, label: coupon.label, type: coupon.type, value: coupon.value, expiresAt: coupon.expiresAt || "", discountAmount };
}
function buildOrderRecord(params: any) {
  return {
    id: crypto.randomUUID(), userId: params.user.id,
    customerName: params.customer.name, customerEmail: params.customer.email || params.user.email,
    customerPhone: params.customer.phone || params.user.phone,
    shippingAddress: { address: params.customer.address, city: params.customer.city, state: params.customer.state, pin: params.customer.pin },
    items: params.pricedCart, subtotal: params.subtotal, discount: params.coupon ? params.coupon.discountAmount : 0,
    couponCode: params.coupon ? params.coupon.code : "", deliveryCharge: params.deliveryCharge || 0,
    gstTotal: params.gstTotal || 0, gstBreakdown: params.gstBreakdown || null,
    total: params.total, depositAmount: params.depositAmount || 0, balanceDue: params.balanceDue || 0,
    paymentMethod: params.paymentMethod, paymentStatus: params.paymentStatus, orderStatus: params.orderStatus || "pending",
    trackingId: params.trackingId || "", courierName: params.courierName || "",
    razorpayOrderId: params.razorpayOrderId || "", razorpayPaymentId: params.razorpayPaymentId || "",
    createdAt: new Date().toISOString(),
  };
}

// ── Email / notifications ────────────────────────────────────────────────────
function getBaseUrl(req: any) {
  if (APP_BASE_URL) return APP_BASE_URL;
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  return `${proto}://${host}`;
}
function getTransporter() {
  if (!(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS)) return null;
  if (!transporterPromise) {
    transporterPromise = import("nodemailer").then((nodemailer) =>
      Promise.resolve(nodemailer.createTransport({
        host: SMTP_HOST, port: Number(SMTP_PORT), secure: Number(SMTP_PORT) === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      }))
    );
  }
  return transporterPromise;
}
function escapeHtml(value: any) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function currency(amount: any) { return Number(amount || 0).toLocaleString("en-IN"); }

function buildOrderTrackingUrl(order: any) {
  const courier = String(order.courierName || "").trim().toLowerCase();
  const tracking = encodeURIComponent(String(order.trackingId || "").trim());
  if (!tracking) return "";
  if (courier.includes("delhivery")) return `https://www.delhivery.com/track/package/${tracking}`;
  if (courier.includes("blue dart") || courier.includes("bluedart")) return `https://www.bluedart.com/tracking?tracking=${tracking}`;
  if (courier.includes("india post") || courier.includes("speed post")) return `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?consignment=${tracking}`;
  if (courier.includes("dtdc")) return `https://www.dtdc.in/tracking/tracking_results.asp?strCnno=${tracking}`;
  if (courier.includes("xpressbees")) return `https://www.xpressbees.com/shipment/tracking?trackingNumber=${tracking}`;
  if (courier.includes("ekart")) return `https://ekartlogistics.com/shipmenttrack/${tracking}`;
  if (courier.includes("ecom")) return `https://ecomexpress.in/tracking/?awb_field=${tracking}`;
  return "";
}

async function sendOrderNotification(order: any, eventType: string, req: any) {
  if (!isValidEmail(order.customerEmail)) return { sent: false, reason: "missing-recipient" };
  const transporter = await getTransporter();
  if (!transporter) return { sent: false, reason: "email-not-configured" };
  const trackingUrl = buildOrderTrackingUrl(order);
  const invoiceUrl = `${getBaseUrl(req)}/api/orders/${order.id}/document?type=invoice`;
  const titleMap: Record<string, string> = {
    placed: "Your Ruh Imperium order is confirmed", paid: "Payment received for your Ruh Imperium order",
    shipped: "Your Ruh Imperium order has been shipped", delivered: "Your Ruh Imperium order has been delivered",
    updated: "Your Ruh Imperium order has been updated",
  };
  const headlineMap: Record<string, string> = {
    placed: "Thank you for placing your order.", paid: "We have received your payment successfully.",
    shipped: "Your package is on the way.", delivered: "Your package has been marked as delivered.",
    updated: "There is an update on your order.",
  };
  const itemsHtml = (order.items || []).map((item: any) => `<li>${escapeHtml(item.name)} (${escapeHtml(item.size)}) × ${escapeHtml(item.qty)}</li>`).join("");
  const html = `<div style="font-family:Arial,sans-serif;background:#eef3f9;padding:24px;color:#162742">
    <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #d6e1ee;padding:28px">
      <h1 style="margin:0 0 10px;font-size:28px">Ruh Imperium</h1>
      <p style="margin:0 0 18px;color:#53657e">${headlineMap[eventType] || headlineMap.updated}</p>
      <div style="padding:16px;background:#f8fbff;border:1px solid #dde6f0;margin-bottom:20px">
        <p style="margin:0 0 8px"><strong>Order ID:</strong> ${escapeHtml(order.id)}</p>
        <p style="margin:0 0 8px"><strong>Status:</strong> ${escapeHtml(String(order.orderStatus || "pending").toUpperCase())}</p>
        <p style="margin:0"><strong>Total:</strong> ₹${currency(order.total || 0)}</p>
      </div>
      <ul style="margin:0 0 20px;padding-left:18px;color:#53657e">${itemsHtml}</ul>
      <div style="margin-top:18px">
        <a href="${invoiceUrl}" style="background:#162742;color:#fff;text-decoration:none;padding:12px 16px;display:inline-block">Open Invoice</a>
        ${trackingUrl ? `<a href="${trackingUrl}" style="background:#2d6a4f;color:#fff;text-decoration:none;padding:12px 16px;display:inline-block;margin-left:8px">Track Package</a>` : ""}
      </div>
    </div>
  </div>`;
  await transporter.sendMail({ from: SMTP_FROM || SMTP_USER, to: order.customerEmail, subject: `${titleMap[eventType] || titleMap.updated} · ${order.id}`, html });
  return { sent: true };
}

async function sendOtpMessage({ phone, otp }: { phone: string; otp: string }) {
  const deliveryMode = getOtpDeliveryMode();
  const mobile = normalizePhone(phone);
  if (deliveryMode !== "sms" || !mobile) return { mode: "preview", previewOtp: otp };
  const payload: any = { template_id: MSG91_TEMPLATE_ID, short_url: "0", recipients: [{ mobiles: mobile, otp }] };
  if (MSG91_SENDER_ID) payload.sender = MSG91_SENDER_ID;
  if (MSG91_ROUTE) payload.route = MSG91_ROUTE;
  const response = await fetch("https://control.msg91.com/api/v5/flow/", {
    method: "POST",
    headers: { authkey: MSG91_AUTH_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Unable to send OTP SMS right now.");
  return { mode: "sms" };
}

async function verifyRecaptchaToken(token: string, remoteIp: string) {
  if (!RECAPTCHA_SECRET_KEY) return { ok: true, reason: "no-secret" };
  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${encodeURIComponent(RECAPTCHA_SECRET_KEY)}&response=${encodeURIComponent(token)}&remoteip=${encodeURIComponent(remoteIp || "")}`,
    });
    return res.json();
  } catch { return { success: false }; }
}

async function createRazorpayOrder(amount: number, receipt: string, notes: any) {
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount, currency: "INR", receipt, notes }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.description || "Unable to create Razorpay order.");
  return data;
}

function buildOrderDocumentHtml(order: any, type: string) {
  const documentTitle = type === "packing-slip" ? "Packing Slip" : "Invoice";
  const address = order.shippingAddress || {};
  const rows = (order.items || []).map((item: any) =>
    type === "packing-slip"
      ? `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.size)}</td><td>${escapeHtml(item.qty)}</td></tr>`
      : `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.size)}</td><td>${escapeHtml(item.qty)}</td><td>₹${currency(item.unitPrice)}</td><td>₹${currency(item.lineTotal)}</td></tr>`
  ).join("");
  const itemHeader = type === "packing-slip"
    ? "<tr><th>Item</th><th>Size</th><th>Qty</th></tr>"
    : "<tr><th>Item</th><th>Size</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${escapeHtml(documentTitle)} ${escapeHtml(order.id)}</title>
<style>body{font-family:Arial,sans-serif;color:#162742;margin:0;background:#eef3f9}.sheet{max-width:900px;margin:24px auto;background:#fff;border:1px solid #d6e1ee;padding:32px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #dde6f0;padding:10px;font-size:14px}th{background:#edf4fb}.summary-line{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e0e8f1}.summary-line.total{font-size:18px;font-weight:700;border-bottom:none}</style>
</head><body><div class="sheet">
<h1 style="margin:0 0 10px">Ruh Imperium</h1>
<p><strong>${escapeHtml(documentTitle)}</strong> · ${escapeHtml(order.id)}</p>
<p>Customer: ${escapeHtml(order.customerName)} · ${escapeHtml(order.customerEmail)}</p>
<p>Address: ${escapeHtml(address.address)}, ${escapeHtml(address.city)}, ${escapeHtml(address.state)} - ${escapeHtml(address.pin)}</p>
<table><thead>${itemHeader}</thead><tbody>${rows}</tbody></table>
<div style="max-width:320px;margin:20px 0 0 auto">
<div class="summary-line"><span>Subtotal</span><strong>₹${currency(order.subtotal)}</strong></div>
${order.discount ? `<div class="summary-line"><span>Discount</span><strong>₹${currency(order.discount)}</strong></div>` : ""}
${order.deliveryCharge ? `<div class="summary-line"><span>Delivery</span><strong>₹${currency(order.deliveryCharge)}</strong></div>` : ""}
<div class="summary-line total"><span>Total</span><strong>₹${currency(order.total)}</strong></div>
</div>
</div></body></html>`;
}

function buildAdminStats(orders: any[]) {
  return {
    totalOrders: orders.length,
    pendingOrders: orders.filter((o) => (o.orderStatus || "pending") === "pending").length,
    shippedOrders: orders.filter((o) => o.orderStatus === "shipped").length,
    deliveredOrders: orders.filter((o) => o.orderStatus === "delivered").length,
    totalRevenue: orders.filter((o) => o.paymentStatus === "paid" || o.paymentStatus === "partial-paid" || o.paymentMethod === "COD").reduce((sum, o) => sum + Number(o.total || 0), 0),
  };
}

function csvEscape(value: any) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }
function buildOrdersCsv(orders: any[]) {
  const header = ["Order ID","Created At","Customer Name","Customer Email","Customer Phone","Payment Method","Payment Status","Order Status","Coupon Code","Subtotal","Discount","Total","Items"];
  const lines = orders.map((o) => [o.id,o.createdAt,o.customerName,o.customerEmail,o.customerPhone,o.paymentMethod,o.paymentStatus,o.orderStatus||"pending",o.couponCode||"",o.subtotal,o.discount,o.total,(o.items||[]).map((i: any)=>`${i.name} (${i.size}) x ${i.qty}`).join(" | ")].map(csvEscape).join(","));
  return [header.map(csvEscape).join(","), ...lines].join("\n");
}
function buildSubscribersCsv(subscribers: any[]) {
  const header = ["Subscriber ID","Email","Created At"];
  const lines = subscribers.map((s) => [s.id,s.email,s.createdAt].map(csvEscape).join(","));
  return [header.map(csvEscape).join(","), ...lines].join("\n");
}

// ── Routes ───────────────────────────────────────────────────────────────────
router.get("/health", (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString(), storage: MONGODB_ENABLED ? "mongodb" : REMOTE_DB_ENABLED ? "supabase" : "sqlite", paymentReady: Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET), adminReady: Boolean(ADMIN_EMAIL) });
});

router.get("/products", (_req, res) => {
  res.json({ products: productCatalog.map(normalizeCatalogProduct) });
});

router.get("/config", (_req, res) => {
  const razorpayConfigured = Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);
  const authConfigured = Boolean(TOKEN_SECRET && TOKEN_SECRET !== "change-this-auth-secret");
  const paymentEnabled = razorpayConfigured && authConfigured;
  res.json({
    backendReady: true, razorpayKeyId: RAZORPAY_KEY_ID, recaptchaSiteKey: RECAPTCHA_SITE_KEY,
    adminEnabled: Boolean(ADMIN_EMAIL), adminEmail: ADMIN_EMAIL, otpDelivery: getOtpDeliveryMode(),
    paymentEnabled, paymentReason: !razorpayConfigured ? "Razorpay keys are missing." : !authConfigured ? "Auth secret is missing." : "",
    health: { storage: MONGODB_ENABLED ? "mongodb" : REMOTE_DB_ENABLED ? "supabase" : "sqlite", paymentEnabled },
  });
});

router.get("/shipping/providers", (_req, res) => {
  res.json({ providers: SHIPPING_PROVIDERS });
});

router.post("/ai-scent-chat", async (req, res) => {
  try {
    const { message = "", tone = "", budget = "" } = req.body;
    const promptText = [String(message).slice(0, 800), String(tone).slice(0, 120), String(budget).slice(0, 80)].filter(Boolean).join(" ");
    if (!promptText) { res.status(400).json({ error: "Tell the scent assistant what tone, mood, or occasion you want." }); return; }
    const suggestions = getLocalScentMatches(promptText, 4);
    if (!OPENAI_API_KEY) { res.json({ reply: buildLocalScentReply(promptText, suggestions), suggestions, source: "local" }); return; }
    const catalogLines = productCatalog.map((p: any) => `${p.id}. ${p.name} | ${p.cat} | notes: ${p.notes} | tags: ${(p.tags||[]).join(", ")} | price: ₹${p.price}`).join("\n");
    try {
      const aiRes = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: OPENAI_MODEL, instructions: "You are Ruh Imperium Scent Assistant. Recommend products from the catalog matching the customer's tone, mood, season, occasion, budget, and note family. Be concise and warm.", input: `Customer: ${promptText}\n\nCatalog:\n${catalogLines}`, max_output_tokens: 420 }),
      });
      const data = await aiRes.json().catch(() => ({}));
      if (!aiRes.ok) { res.json({ reply: buildLocalScentReply(promptText, suggestions), suggestions, source: "local" }); return; }
      const parts: string[] = [];
      (data?.output || []).forEach((item: any) => (item.content || []).forEach((c: any) => { if (typeof c.text === "string") parts.push(c.text); }));
      res.json({ reply: parts.join("\n").trim() || buildLocalScentReply(promptText, suggestions), suggestions, source: "openai" });
    } catch { res.json({ reply: buildLocalScentReply(promptText, suggestions), suggestions, source: "local" }); }
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/newsletter/subscribe", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!isValidEmail(email)) { res.status(400).json({ error: "Please enter a valid email address." }); return; }
    const subscribers = await readSubscribers();
    if (subscribers.find((s: any) => s.email === email)) { res.json({ subscribed: true, alreadySubscribed: true, email }); return; }
    subscribers.push({ id: crypto.randomUUID(), email, createdAt: new Date().toISOString() });
    await writeSubscribers(subscribers);
    res.status(201).json({ subscribed: true, email });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/auth/signup", async (req, res) => {
  try {
    const { name = "", email = "", phone = "", password = "" } = req.body;
    const nm = String(name).trim(); const em = String(email).trim().toLowerCase(); const ph = String(phone).trim(); const pw = String(password);
    if (!nm || !em || !ph || pw.length < 6) { res.status(400).json({ error: "Name, email, phone, and a 6+ character password are required." }); return; }
    const users = await readUsers();
    if (users.some((u: any) => u.email === em)) { res.status(409).json({ error: "An account with this email already exists." }); return; }
    const passwordData = hashPassword(pw);
    const user = { id: crypto.randomUUID(), name: nm, email: em, phone: ph, passwordSalt: passwordData.salt, passwordHash: passwordData.hash, createdAt: new Date().toISOString() };
    users.push(user);
    await writeUsers(users);
    res.status(201).json({ user: sanitizeUser(user), token: createToken(user) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!email || !password) { res.status(400).json({ error: "Email and password are required." }); return; }
    const users = await readUsers();
    const user = users.find((u: any) => u.email === email);
    if (!user || !verifyPassword(password, user)) { res.status(401).json({ error: "Invalid email or password." }); return; }
    res.json({ user: sanitizeUser(user), token: createToken(user) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/auth/request-otp", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const phone = String(req.body.phone || "").trim();
    const createIfMissing = Boolean(req.body.createIfMissing);
    if (!email && !phone) { res.status(400).json({ error: "Email or phone is required." }); return; }
    if (RECAPTCHA_SITE_KEY && RECAPTCHA_SECRET_KEY) {
      const token = String(req.body.recaptcha || "").trim();
      if (!token) { res.status(400).json({ error: "Please complete the captcha challenge." }); return; }
      const verification = await verifyRecaptchaToken(token, req.ip || "");
      if (!verification?.success) { res.status(400).json({ error: "Captcha verification failed." }); return; }
    }
    const users = await readUsers();
    let targetUser = users.find((u: any) => (email && u.email === email) || (phone && u.phone === phone));
    if (!targetUser) {
      if (createIfMissing) {
        targetUser = { id: crypto.randomUUID(), name: email ? (email.split("@")[0] || "Guest") : (phone || "Guest"), email: email || "", phone: phone || "", passwordSalt: "", passwordHash: "", createdAt: new Date().toISOString() };
        users.push(targetUser);
        await writeUsers(users);
      } else { res.status(404).json({ error: "No account found for that email or phone." }); return; }
    }
    const code = generateOtp();
    const otps = (await readOtps()).filter((o: any) => o.userId !== targetUser.id && o.expiresAt > Date.now());
    otps.push({ userId: targetUser.id, purpose: "login", email: targetUser.email, phone: targetUser.phone, codeHash: crypto.createHash("sha256").update(code).digest("hex"), expiresAt: Date.now() + 5 * 60 * 1000 });
    await writeOtps(otps);
    const delivery = await sendOtpMessage({ phone: targetUser.phone || phone, otp: code });
    res.json({ message: delivery.mode === "sms" ? `OTP sent to ${targetUser.phone || phone}.` : `OTP generated. SMS is not configured yet.`, identifier: email || phone, delivery: delivery.mode, previewOtp: (delivery as any).previewOtp || "" });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/auth/verify-otp", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const phone = String(req.body.phone || "").trim();
    const otp = String(req.body.otp || "").trim();
    if ((!email && !phone) || !otp) { res.status(400).json({ error: "Email or phone and OTP are required." }); return; }
    const users = await readUsers();
    const user = users.find((u: any) => (email && u.email === email) || (phone && u.phone === phone));
    if (!user) { res.status(404).json({ error: "Account not found." }); return; }
    const otps = await readOtps();
    const match = otps.find((o: any) => o.userId === user.id && o.purpose === "login" && o.expiresAt > Date.now());
    if (!match) { res.status(400).json({ error: "OTP expired. Please request a new one." }); return; }
    if (match.codeHash !== crypto.createHash("sha256").update(otp).digest("hex")) { res.status(400).json({ error: "Invalid OTP." }); return; }
    await writeOtps(otps.filter((o: any) => o.userId !== user.id));
    res.json({ user: sanitizeUser(user), token: createToken(user), needsPassword: !(user.passwordHash && String(user.passwordHash).length) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/auth/set-password", async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) { res.status(401).json({ error: "Authentication required." }); return; }
    const password = String(req.body.password || "");
    if (password.length < 6) { res.status(400).json({ error: "Password must be at least 6 characters." }); return; }
    const users = await readUsers();
    const user = users.find((u: any) => u.id === authUser.id);
    if (!user) { res.status(404).json({ error: "User not found." }); return; }
    const pwd = hashPassword(password);
    user.passwordSalt = pwd.salt; user.passwordHash = pwd.hash;
    await writeUsers(users);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/orders/request-otp", async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) { res.status(401).json({ error: "Please sign in again before requesting order OTP." }); return; }
    const email = String(req.body.email || authUser.email || "").trim().toLowerCase();
    const phone = String(req.body.phone || authUser.phone || "").trim();
    if (!email && !phone) { res.status(400).json({ error: "Email or phone is required." }); return; }
    const code = generateOtp();
    const otps = (await readOtps()).filter((o: any) => !(o.userId === authUser.id && o.purpose === "order") && o.expiresAt > Date.now());
    otps.push({ userId: authUser.id, purpose: "order", email, phone, codeHash: crypto.createHash("sha256").update(code).digest("hex"), expiresAt: Date.now() + 5 * 60 * 1000 });
    await writeOtps(otps);
    const delivery = await sendOtpMessage({ phone, otp: code });
    res.json({ message: delivery.mode === "sms" ? `Order OTP sent to ${phone || email}.` : `Order OTP generated. SMS is not configured yet.`, identifier: phone || email, delivery: delivery.mode, previewOtp: (delivery as any).previewOtp || "" });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/orders/verify-otp", async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) { res.status(401).json({ error: "Please sign in again before verifying order OTP." }); return; }
    const email = String(req.body.email || "").trim().toLowerCase();
    const phone = String(req.body.phone || "").trim();
    const otp = String(req.body.otp || "").trim();
    if ((!email && !phone) || !otp) { res.status(400).json({ error: "Email or phone and OTP are required." }); return; }
    const otps = await readOtps();
    const match = otps.find((o: any) => o.userId === authUser.id && o.purpose === "order" && o.expiresAt > Date.now() && ((email && o.email === email) || (phone && o.phone === phone)));
    if (!match) { res.status(400).json({ error: "Order OTP expired. Please request a new one." }); return; }
    if (match.codeHash !== crypto.createHash("sha256").update(otp).digest("hex")) { res.status(400).json({ error: "Invalid order OTP." }); return; }
    await writeOtps(otps.filter((o: any) => !(o.userId === authUser.id && o.purpose === "order")));
    res.json({ verified: true, identifier: phone || email });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/coupons/validate", async (req, res) => {
  try {
    const pricedCart = buildPricedCart(req.body.cart);
    const subtotal = calculateSubtotal(pricedCart);
    const coupon = validateCoupon(req.body.code, subtotal);
    const pricing = calculatePricing(pricedCart, coupon, req.body.customer || {});
    res.json({ coupon: { ...coupon, subtotal: pricing.subtotal, finalTotal: pricing.total, deliveryCharge: pricing.deliveryCharge, gstTotal: pricing.gstTotal, gstBreakdown: pricing.gstBreakdown }, pricing });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

router.post("/payments/razorpay/order", async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) { res.status(401).json({ error: "Please sign in again before payment." }); return; }
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) { res.status(500).json({ error: "Razorpay keys are missing on the server." }); return; }
    const pricedCart = buildPricedCart(req.body.cart);
    const subtotal = calculateSubtotal(pricedCart);
    const coupon = req.body.couponCode ? validateCoupon(req.body.couponCode, subtotal) : null;
    const pricing = calculatePricing(pricedCart, coupon, req.body.customer || {});
    const paymentPlan = String(req.body.paymentPlan || "full").trim() === "partial-cod" ? "partial-cod" : "full";
    const depositAmount = paymentPlan === "partial-cod" ? Math.max(1, Math.round(pricing.total * (PARTIAL_COD_DEPOSIT_PERCENT / 100))) : pricing.total;
    const balanceDue = Math.max(pricing.total - depositAmount, 0);
    const razorpayOrder = await createRazorpayOrder(depositAmount * 100, `ruh_${Date.now()}`, { customerEmail: authUser.email, coupon: coupon ? coupon.code : "None", paymentPlan });
    const orders = await readOrders();
    const internalOrder = buildOrderRecord({ user: authUser, customer: req.body.customer || {}, pricedCart, subtotal, coupon, total: pricing.total, deliveryCharge: pricing.deliveryCharge, gstTotal: pricing.gstTotal, gstBreakdown: pricing.gstBreakdown, depositAmount, balanceDue, paymentMethod: paymentPlan === "partial-cod" ? "Partial COD" : "Razorpay", paymentStatus: "created", orderStatus: "pending", razorpayOrderId: razorpayOrder.id });
    orders.push(internalOrder);
    await writeOrders(orders);
    res.json({ keyId: RAZORPAY_KEY_ID, orderId: razorpayOrder.id, razorpayOrderId: razorpayOrder.id, backendOrderId: internalOrder.id, amount: razorpayOrder.amount, currency: razorpayOrder.currency });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/payments/razorpay/verify", async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) { res.status(401).json({ error: "Please sign in again before payment verification." }); return; }
    if (!RAZORPAY_KEY_SECRET) { res.status(500).json({ error: "Razorpay key secret is missing." }); return; }
    const expected = crypto.createHmac("sha256", RAZORPAY_KEY_SECRET).update(`${req.body.orderId}|${req.body.paymentId}`).digest("hex");
    if (expected !== req.body.signature) { res.status(400).json({ error: "Payment signature verification failed." }); return; }
    const orders = await readOrders();
    const order = orders.find((o: any) => o.razorpayOrderId === req.body.orderId && o.userId === authUser.id);
    if (order) {
      order.paymentStatus = order.paymentMethod === "Partial COD" ? "partial-paid" : "paid";
      order.razorpayPaymentId = req.body.paymentId; order.paidAt = new Date().toISOString();
      await writeOrders(orders);
      try { await sendOrderNotification(order, "paid", req); } catch (e: any) { logger.error({ err: e }, "Payment email failed"); }
    }
    res.json({ verified: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/orders/cod", async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) { res.status(401).json({ error: "Please sign in again before placing the order." }); return; }
    const pricedCart = buildPricedCart(req.body.cart);
    const subtotal = calculateSubtotal(pricedCart);
    const coupon = req.body.couponCode ? validateCoupon(req.body.couponCode, subtotal) : null;
    const pricing = calculatePricing(pricedCart, coupon, req.body.customer || {});
    const orders = await readOrders();
    const order = buildOrderRecord({ user: authUser, customer: req.body.customer || {}, pricedCart, subtotal, coupon, total: pricing.total, deliveryCharge: pricing.deliveryCharge, gstTotal: pricing.gstTotal, gstBreakdown: pricing.gstBreakdown, paymentMethod: "COD", paymentStatus: "pending", orderStatus: "pending" });
    orders.push(order);
    await writeOrders(orders);
    try { await sendOrderNotification(order, "placed", req); } catch (e: any) { logger.error({ err: e }, "Order email failed"); }
    res.status(201).json({ orderId: order.id });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

router.get("/orders", async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) { res.status(401).json({ error: "Please sign in again to view your orders." }); return; }
    const orders = (await readOrders()).filter((o: any) => o.userId === authUser.id).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ orders });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/orders/:orderId/document", async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) { res.status(401).json({ error: "Please sign in again to view this document." }); return; }
    const orders = await readOrders();
    const order = orders.find((o: any) => o.id === req.params.orderId);
    const isAdmin = Boolean(ADMIN_EMAIL) && authUser.email === ADMIN_EMAIL;
    if (!order || (!isAdmin && order.userId !== authUser.id)) { res.status(403).json({ error: "You do not have access to this order document." }); return; }
    const type = req.query.type === "packing-slip" ? "packing-slip" : "invoice";
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(buildOrderDocumentHtml(order, type));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/admin/orders", async (req, res) => {
  try {
    const adminUser = await getAdminUser(req);
    if (!adminUser) { res.status(403).json({ error: "Admin access required." }); return; }
    const orders = (await readOrders()).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ orders });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/admin/stats", async (req, res) => {
  try {
    const adminUser = await getAdminUser(req);
    if (!adminUser) { res.status(403).json({ error: "Admin access required." }); return; }
    const orders = await readOrders();
    res.json({ stats: buildAdminStats(orders) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/admin/orders/export.csv", async (req, res) => {
  try {
    const adminUser = await getAdminUser(req);
    if (!adminUser) { res.status(403).json({ error: "Admin access required." }); return; }
    const orders = (await readOrders()).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.send(buildOrdersCsv(orders));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/admin/subscribers", async (req, res) => {
  try {
    const adminUser = await getAdminUser(req);
    if (!adminUser) { res.status(403).json({ error: "Admin access required." }); return; }
    const subscribers = (await readSubscribers()).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ subscribers });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/admin/subscribers/export.csv", async (req, res) => {
  try {
    const adminUser = await getAdminUser(req);
    if (!adminUser) { res.status(403).json({ error: "Admin access required." }); return; }
    const subscribers = (await readSubscribers()).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.send(buildSubscribersCsv(subscribers));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/admin/subscribers/:subscriberId", async (req, res) => {
  try {
    const adminUser = await getAdminUser(req);
    if (!adminUser) { res.status(403).json({ error: "Admin access required." }); return; }
    const subscribers = await readSubscribers();
    const next = subscribers.filter((s: any) => s.id !== req.params.subscriberId);
    if (next.length === subscribers.length) { res.status(404).json({ error: "Subscriber not found." }); return; }
    await writeSubscribers(next);
    res.json({ removed: true, subscriberId: req.params.subscriberId });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.patch("/admin/orders/:orderId/status", async (req, res) => {
  try {
    const adminUser = await getAdminUser(req);
    if (!adminUser) { res.status(403).json({ error: "Admin access required." }); return; }
    const nextStatus = String(req.body.orderStatus || "").trim().toLowerCase();
    const nextTrackingId = String(req.body.trackingId || "").trim();
    const nextCourierName = String(req.body.courierName || "").trim();
    const validStatuses = ["pending","confirmed","shipped","delivered"];
    if (!nextStatus && !nextTrackingId && !nextCourierName) { res.status(400).json({ error: "Order status, courier, or tracking ID is required." }); return; }
    if (nextStatus && !validStatuses.includes(nextStatus)) { res.status(400).json({ error: "Invalid order status." }); return; }
    const orders = await readOrders();
    const order = orders.find((o: any) => o.id === req.params.orderId);
    if (!order) { res.status(404).json({ error: "Order not found." }); return; }
    if (nextStatus) order.orderStatus = nextStatus;
    order.trackingId = nextTrackingId; order.courierName = nextCourierName; order.updatedAt = new Date().toISOString();
    await writeOrders(orders);
    try {
      const eventType = order.orderStatus === "shipped" ? "shipped" : order.orderStatus === "delivered" ? "delivered" : "updated";
      await sendOrderNotification(order, eventType, req);
    } catch (e: any) { logger.error({ err: e }, "Order status email failed"); }
    res.json({ order });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
