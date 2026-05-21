const STATIC_CACHE = 'ruh-imperium-static-v6';
const RUNTIME_CACHE = 'ruh-imperium-runtime-v4';
const OFFLINE_URL = '/offline.html';

const APP_SHELL = [
    '/',
    '/index.html',
    '/app.js',
    '/products.js',
    '/effects-3d.js',
    '/raahi-theme.css',
    '/ruh-imperium-logo.png',
    '/sw.js',
    '/manifest.webmanifest',
    '/offline.html',
    '/pwa-icons/ruh-logo-192.png'
];

async function cacheShell(cache) {
    await Promise.all(APP_SHELL.map(async url => {
        try {
            const response = await fetch(url, { cache: 'no-cache' });
            if (response.ok) await cache.put(url, response);
        } catch (error) {
            // Skip missing assets so install does not fail on mobile.
        }
    }));
}

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then(cache => cacheShell(cache)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

function isCatalogAsset(pathname) {
    return pathname.endsWith('.js')
        || pathname.endsWith('.html')
        || pathname === '/products.js'
        || pathname.endsWith('/products.js');
}

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return;

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    const copy = response.clone();
                    caches.open(RUNTIME_CACHE).then(cache => cache.put(request, copy));
                    return response;
                })
                .catch(async () => caches.match('/index.html') || caches.match(OFFLINE_URL))
        );
        return;
    }

    if (isCatalogAsset(url.pathname)) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response && response.status === 200) {
                        const copy = response.clone();
                        caches.open(RUNTIME_CACHE).then(cache => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    event.respondWith(
        caches.match(request).then(cached => {
            if (cached) return cached;
            return fetch(request)
                .then(response => {
                    if (!response || response.status !== 200 || response.type !== 'basic') return response;
                    const copy = response.clone();
                    caches.open(RUNTIME_CACHE).then(cache => cache.put(request, copy));
                    return response;
                })
                .catch(() => {
                    if (request.destination === 'image') {
                        return caches.match('/pwa-icons/ruh-logo-192.png');
                    }
                    return caches.match(OFFLINE_URL);
                });
        })
    );
});
