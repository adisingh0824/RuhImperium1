/**
 * Import full Raahi Parfums catalog into database/products.js
 * Source: https://www.raahiparfums.com/products.json
 */
const fs = require('fs');
const https = require('https');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'database', 'products.js');

const COLLECTION_MAP = {
    'botanical-perfumes': 'Authentic Indian Attars',
    'modern-attar-kannauj-attar': 'Modern Attars',
    'modern-attars': 'Modern Attars',
    'eau-de-parfum-kannauj-attar': 'Eau De Parfum',
    'discovery-set-kannauj-attar': 'Discovery Set',
    'ruh-absolute-oil': 'Ruh / Absolute Oil'
};

const NEXT_GEN_HANDLES = new Set([
    'rumis-rose-oud-indian-attar-12ml',
    'raas-leela-indian-attar-12ml',
    'mogra-madness-indian-attar-12ml-1',
    'black-musk-indian-attar-12ml',
    'pinklotus-indian-attar-12ml',
    'raat-ki-rani-indian-attar-12ml',
    'jazmin-jasmine-grandiflorum-indian-attar-12ml',
    'oud-raga-indian-attar-12ml',
    'sunset-desert-oud-vanilla-indian-attar-12ml',
    'shamamatul-amber-indian-attar-aged-8-years-12ml',
    'copy-of-pink-lotus-attar-indian-attar-12ml'
]);

const WELLNESS_HANDLES = new Set([
    'sandalwood-log-50gm',
    'sandal-stick-chandan-log-rubbing-stone',
    'sandalwood-powder-25gm',
    'sandalwood-powder-100-pure-25gm-copy',
    'rose-water-200ml-made-from-freshly-harvested-kannauj-roses',
    'rose-water-100ml-made-from-freshly-harvested-kannauj-roses',
    'sandalwood-oil-100-pure'
]);

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'RuhImperium-Import/1.0' } }, res => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', reject);
    });
}

function stripHtml(html) {
    return String(html || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 320);
}

function shortName(title) {
    return title
        .split('|')[0]
        .replace(/\s+/g, ' ')
        .trim();
}

function mapNote(product) {
    const blob = [
        product.title,
        ...(Array.isArray(product.tags) ? product.tags : []),
        product.product_type
    ].join(' ').toLowerCase();

    if (/floral|rose|mogra|jasmine|lotus|gulab|kewra|nargis|parijat|champa|rajni|bela|genda|lily|frangipani/i.test(blob)) return 'Floral';
    if (/woody|oud|sandalwood|khus|mitti|vetiver|loban/i.test(blob)) return 'Woody';
    if (/fresh|aquatic|forest rush|lavender/i.test(blob)) return 'Fresh';
    if (/musky|musk|amber/i.test(blob)) return 'Musky';
    if (/gourmand|vanilla|caramel|sweet|eclair/i.test(blob)) return 'Gourmand';
    if (/oriental|spice|hina|kesar|saffron|shamama|shamamatul/i.test(blob)) return 'Oriental';
    return 'Mixed';
}

function mapTags(product) {
    const tags = Array.isArray(product.tags) ? product.tags : [];
    const out = new Set();
    tags.forEach(tag => {
        const value = String(tag).toLowerCase();
        if (value.includes('daily')) out.add('Daily');
        if (value.includes('office')) out.add('Office');
        if (value.includes('party')) out.add('Party');
        if (value.includes('summer')) out.add('Summer');
        if (value.includes('winter')) out.add('Winter');
        if (value.includes('festive') || value.includes('festival')) out.add('Festival');
        if (value.includes('gift')) out.add('Gifting');
    });
    if (!out.size) out.add('Daily');
    return [...out];
}

function mapCategory(product, handleCollections) {
    const handle = product.handle;
    if (WELLNESS_HANDLES.has(handle)) return 'Wellness';
    if (NEXT_GEN_HANDLES.has(handle)) return 'Next Gen Fragrances';

    const collections = handleCollections.get(handle) || [];
    const priority = [
        'discovery-set-kannauj-attar',
        'ruh-absolute-oil',
        'eau-de-parfum-kannauj-attar',
        'modern-attars',
        'modern-attar-kannauj-attar',
        'botanical-perfumes'
    ];
    for (const key of priority) {
        if (collections.includes(key)) return COLLECTION_MAP[key];
    }

    const title = product.title.toLowerCase();
    if (title.includes('discovery set')) return 'Discovery Set';
    if (title.includes('eau de parfum')) return 'Eau De Parfum';
    if (title.includes('ruh ') || title.includes('absolute oil')) return 'Ruh / Absolute Oil';
    if (title.includes('rose water') || title.includes('sandalwood log') || title.includes('sandalwood powder')) {
        return 'Wellness';
    }
    if (title.includes('indian attar | 12ml')) return 'Next Gen Fragrances';
    if (title.includes('modern indian attar') || title.includes('modern attar')) return 'Modern Attars';
    if (title.includes('attar') || title.includes('handcrafted in kannauj')) return 'Authentic Indian Attars';
    return 'Authentic Indian Attars';
}

function variantSummary(product) {
    const sizes = [...new Set(product.variants.map(v => {
        if (v.title && v.title !== 'Default Title') return v.title;
        if (v.option1 && v.option1 !== 'Default Title') return v.option1;
        if (v.option2 && v.option2 !== 'Default Title') return v.option2;
        return null;
    }).filter(Boolean))];
    return sizes.length ? sizes : ['Standard'];
}

function priceSummary(product) {
    const prices = product.variants
        .map(v => Number(v.price))
        .filter(n => Number.isFinite(n) && n > 0);
    const compare = product.variants
        .map(v => Number(v.compare_at_price))
        .filter(n => Number.isFinite(n) && n > 0);
    const minPrice = Math.min(...prices);
    const maxCompare = compare.length ? Math.max(...compare) : null;
    return {
        price: Math.round(minPrice),
        oldPrice: maxCompare && maxCompare > minPrice ? Math.round(maxCompare) : null
    };
}

async function loadCollectionMembership() {
    const handleCollections = new Map();
    const collectionKeys = Object.keys(COLLECTION_MAP).concat(['best-sellings']);

    for (const handle of collectionKeys) {
        const json = await fetchJson(`https://www.raahiparfums.com/collections/${handle}/products.json?limit=250`);
        json.products.forEach(product => {
            const list = handleCollections.get(product.handle) || [];
            if (!list.includes(handle)) list.push(handle);
            handleCollections.set(product.handle, list);
        });
    }

    const bestsellerHandles = new Set();
    const best = await fetchJson('https://www.raahiparfums.com/collections/best-sellings/products.json?limit=250');
    best.products.forEach(product => bestsellerHandles.add(product.handle));

    return { handleCollections, bestsellerHandles };
}

function esc(str) {
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function main() {
    const [{ handleCollections, bestsellerHandles }, catalog] = await Promise.all([
        loadCollectionMembership(),
        fetchJson('https://www.raahiparfums.com/products.json?limit=250')
    ]);

    const products = catalog.products
        .filter(p => p.published_at)
        .sort((a, b) => a.title.localeCompare(b.title))
        .map((product, index) => {
            const { price, oldPrice } = priceSummary(product);
            const sizes = variantSummary(product);
            const hasSale = product.variants.some(v => Number(v.compare_at_price) > Number(v.price));
            const badge = product.tags?.includes?.('NEW') || (Array.isArray(product.tags) && product.tags.some(t => /new/i.test(t)))
                ? 'NEW'
                : (hasSale ? 'SALE' : null);

            return {
                id: index + 1,
                name: shortName(product.title),
                img: product.images[0]?.src || '',
                cat: mapCategory(product, handleCollections),
                notes: mapNote(product),
                price,
                oldPrice,
                stars: 4.8,
                reviews: Math.max(8, Math.floor((product.id % 140) + 12)),
                badge,
                sizes: sizes.length > 3 ? sizes.slice(0, 3) : sizes,
                desc: stripHtml(product.body_html) || `${shortName(product.title)} — handcrafted in Kannauj.`,
                bestseller: bestsellerHandles.has(product.handle),
                tags: mapTags(product),
                handle: product.handle
            };
        });

    const lines = products.map(p => {
        const badge = p.badge ? `'${p.badge}'` : 'null';
        const oldPrice = p.oldPrice ? p.oldPrice : 'null';
        const bestseller = p.bestseller ? 'true' : 'false';
        const sizes = p.sizes.map(s => `'${esc(s)}'`).join(', ');
        const tags = p.tags.map(t => `'${esc(t)}'`).join(', ');
        return `    { id:${p.id}, name:'${esc(p.name)}', img:'${esc(p.img)}', cat:'${esc(p.cat)}', notes:'${p.notes}', price:${p.price}, oldPrice:${oldPrice}, stars:${p.stars}, reviews:${p.reviews}, badge:${badge}, sizes:[${sizes}], desc:'${esc(p.desc)}', bestseller:${bestseller}, tags:[${tags}] }`;
    });

    const file = `//PRODUCTS DETAIL — Ruh Imperium catalog (${products.length} products)\nconst products = [\n${lines.join(',\n')}\n];\n`;
    fs.writeFileSync(OUT, file);
    console.log('Run: node scripts/rebrand-catalog.js && npm run sync:products');

    const summary = {};
    products.forEach(p => { summary[p.cat] = (summary[p.cat] || 0) + 1; });
    console.log(`Wrote ${products.length} products to ${OUT}`);
    console.log('By category:', summary);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
