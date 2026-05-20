const { handleApi } = require('../backend/server');

module.exports = async (req, res) => {
    try {
        const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
        let pathname = decodeURIComponent(url.pathname);
        const rewrittenPath = url.searchParams.get('path');
        if ((pathname === '/api' || pathname === '/api/') && rewrittenPath) {
            pathname = `/api/${rewrittenPath.replace(/^\/+/, '')}`;
            url.pathname = pathname;
            url.searchParams.delete('path');
        }
        await handleApi(req, res, pathname, url);
    } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: error.message || 'Internal server error.' }));
    }
};
