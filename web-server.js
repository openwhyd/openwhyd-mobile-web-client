const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const root = process.cwd();
const PORT = process.env.PORT || 8000;
const HOST = '::'; // listen on IPv6 any-address so http://[::]:8000/adrien works
const mime = { html: 'text/html', css: 'text/css', js: 'application/javascript', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif' };

function safeJoin(base, target) {
    const targetPath = '.' + path.posix.normalize('/' + target);
    return path.join(base, targetPath);
}

const server = http.createServer((req, res) => {
    try {
        const u = url.parse(req.url || '/');
        const pathname = decodeURIComponent(u.pathname || '/');
        const filePath = safeJoin(root, pathname);

        // Serve file if exists
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).slice(1).toLowerCase();
            res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
            fs.createReadStream(filePath).pipe(res);
            return;
        }

        // Not found: serve 404.html (GitHub Pages behavior)
        const f404 = path.join(root, '404.html');
        res.writeHead(404, { 'Content-Type': 'text/html' });
        fs.createReadStream(f404).pipe(res);
    } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server error');
        console.error(e);
    }
});

server.listen(PORT, HOST, () => console.log(`Dev server listening on http://[::]:${PORT}`));
