const { handleApi } = require('../server');

module.exports = async (req, res) => {
    try {
        const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
        const pathname = decodeURIComponent(url.pathname);
        await handleApi(req, res, pathname, url);
    } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: error.message || 'Internal server error.' }));
    }
};
