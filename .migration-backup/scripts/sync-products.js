const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', 'database', 'products.js');
const target = path.join(__dirname, '..', 'frontend', 'products.js');
const banner = '//PRODUCTS DETAIL — keep in sync with database/products.js (npm run sync:products)\n';

let content = fs.readFileSync(source, 'utf8');
content = content.replace(/^\/\/PRODUCTS DETAIL\r?\n/, banner);
content = content.replace(/^const products = /, 'var products = ');

fs.writeFileSync(target, content);
console.log(`Synced ${source} -> ${target}`);
