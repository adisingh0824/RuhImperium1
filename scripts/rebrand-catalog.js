/**
 * Rebrand imported catalog: local images only, no Raahi branding in text.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CATALOG = path.join(__dirname, '..', 'database', 'products.js');

const CATEGORY_IMAGES = {
    'Authentic Indian Attars': 'gulabattar.png',
    'Modern Attars': 'mitti.png',
    'Next Gen Fragrances': 'cafe rose.png',
    'Eau De Parfum': 'vanilla.png',
    'Ruh / Absolute Oil': 'amiri.png',
    'Discovery Set': 'set4.png',
    'Wellness': 'gulabattar.png'
};

function pickLocalImage(product) {
    const name = product.name.toLowerCase();
    if (name.includes('mitti')) return 'mitti.png';
    if (name.includes('dubai')) return 'dubai gold.png';
    if (name.includes('hawas')) return 'hawas ice.png';
    if (name.includes('cr-7') || name.includes('cristiano')) return 'cr.png';
    if (name.includes('grapes')) return 'grapes.png';
    if (name.includes('green apple')) return 'green apple.png';
    if (name.includes('cafe rose') || name.includes('champa')) return 'cafe rose.png';
    if (name.includes('eclair') || name.includes('e\'clair')) return 'eclair.png';
    if (name.includes('amiri')) return 'amiri.png';
    if (name.includes('tommy')) return 'tommy girl.png';
    if (name.includes('vanilla')) return 'vanilla.png';
    if (name.includes('discovery') || name.includes('set')) return 'set4.png';
    if (name.includes('mogra') || name.includes('gulab') || name.includes('rose') || name.includes('jasmine')) {
        return 'gulabattar.png';
    }
    return CATEGORY_IMAGES[product.cat] || 'gulabattar.png';
}

function sanitizeText(text) {
    return String(text || '')
        .replace(/Raahi\s*Parfums/gi, 'Ruh Imperium')
        .replace(/Raahiparfums\.com/gi, 'Ruh Imperium')
        .replace(/\bRaahi\b/gi, 'Ruh Imperium')
        .replace(/&amp;/g, '&')
        .trim();
}

function formatDisplayName(product) {
    const size = product.sizes?.[0] && product.sizes[0] !== 'Standard' ? product.sizes[0] : '';
    const catLabel = product.cat === 'Authentic Indian Attars'
        ? 'Authentic Indian Attar | Handcrafted in Kannauj'
        : product.cat === 'Next Gen Fragrances'
            ? 'Indian Attar'
            : product.cat === 'Eau De Parfum'
                ? 'Eau De Parfum'
                : product.cat;
    if (product.cat === 'Authentic Indian Attars' && !size) {
        return `${product.name} | ${catLabel}`;
    }
    return size ? `${product.name} | ${catLabel} | ${size}` : `${product.name} | ${catLabel}`;
}

function loadProducts() {
    const file = fs.readFileSync(CATALOG, 'utf8');
    const context = { globalThis: {} };
    vm.createContext(context);
    vm.runInContext(`${file}\nglobalThis.__products = products;`, context);
    return context.globalThis.__products || [];
}

function esc(str) {
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function main() {
    const products = loadProducts().map((product, index) => {
        const cleanName = sanitizeText(product.name.split('|')[0].trim());
        const next = {
            ...product,
            id: index + 1,
            name: cleanName,
            img: pickLocalImage({ ...product, name: cleanName }),
            desc: sanitizeText(product.desc)
        };
        next.displayName = formatDisplayName(next);
        return next;
    });

    const lines = products.map(p => {
        const badge = p.badge ? `'${p.badge}'` : 'null';
        const oldPrice = p.oldPrice ? p.oldPrice : 'null';
        const sizes = p.sizes.map(s => `'${esc(s)}'`).join(', ');
        const tags = p.tags.map(t => `'${esc(t)}'`).join(', ');
        const bestseller = p.bestseller ? 'true' : 'false';
        return `    { id:${p.id}, name:'${esc(p.name)}', displayName:'${esc(p.displayName || p.name)}', img:'${esc(p.img)}', cat:'${esc(p.cat)}', notes:'${p.notes}', price:${p.price}, oldPrice:${oldPrice}, stars:${p.stars}, reviews:${p.reviews}, badge:${badge}, sizes:[${sizes}], desc:'${esc(p.desc)}', bestseller:${bestseller}, tags:[${tags}] }`;
    });

    const file = `//PRODUCTS DETAIL — Ruh Imperium catalog (${products.length} products)\nconst products = [\n${lines.join(',\n')}\n];\n`;
    fs.writeFileSync(CATALOG, file);
    console.log(`Rebranded ${products.length} products → local images, Ruh Imperium copy`);
}

main();
