const { handleApi } = require('../backend/server');

function resolveApiPathname(req, url) {
    let pathname = decodeURIComponent(url.pathname || '/api');
    if (req.query && req.query.path) {
        const segments = Array.isArray(req.query.path) ? req.query.path : String(req.query.path).split('/');
        pathname = `/api/${segments.filter(Boolean).join('/')}`;
    }
    const rewrittenPath = url.searchParams.get('path');
    if (rewrittenPath && (pathname === '/api' || pathname === '/api/')) {
        pathname = `/api/${rewrittenPath.replace(/^\/+/, '')}`;
    }
    return pathname.replace(/\/+$/, '') || '/api';
}

module.exports = async (req, res) => {
    try {
        const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
        const pathname = resolveApiPathname(req, url);
        await handleApi(req, res, pathname, url);
    } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: error.message || 'Internal server error.' }));
    }
};
