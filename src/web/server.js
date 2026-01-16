const express = require('express');
const path = require('path');
const cors = require('cors');

class WebServer {
    constructor(client) {
        this.client = client;
        this.app = express();
        this.port = process.env.PORT || 24710;
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Trust proxy (PENTING untuk hosting)
        this.app.set('trust proxy', true);
        
        // CORS - Allow all origins
        this.app.use(cors({
            origin: '*',
            methods: ['GET', 'POST'],
            credentials: true
        }));
        
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        
        // Request logging
        this.app.use((req, res, next) => {
            console.log(`[Web] ${new Date().toISOString()} | ${req.method} ${req.path}`);
            next();
        });
        
        // Static files
        this.app.use(express.static(path.join(__dirname, 'public')));
        
        // View engine
        this.app.set('view engine', 'ejs');
        this.app.set('views', path.join(__dirname, 'views'));
        
        // Pass client to routes
        this.app.use((req, res, next) => {
            req.client = this.client;
            next();
        });
    }

    setupRoutes() {
        // Root health check (untuk HidenCloud)
        this.app.get('/health', (req, res) => {
            res.status(200).json({ 
                status: 'online',
                bot: this.client.user?.tag || 'Starting...',
                timestamp: Date.now()
            });
        });

        // Import routes
        try {
            const indexRoutes = require('./routes/index');
            const apiRoutes = require('./routes/api');
            
            this.app.use('/', indexRoutes);
            this.app.use('/api', apiRoutes);
        } catch (error) {
            console.error('[Web] Route error:', error.message);
            
            // Fallback route jika routes gagal load
            this.app.get('/', (req, res) => {
                res.json({
                    status: 'online',
                    bot: this.client.user?.tag || 'Aori Bot',
                    servers: this.client.guilds?.cache?.size || 0,
                    uptime: this.client.uptime,
                    message: '🎵 Aori Bot is running!'
                });
            });
        }

        // 404 Handler
        this.app.use((req, res) => {
            res.status(404).json({ 
                error: 'Not Found',
                path: req.path,
                availableRoutes: ['/', '/health', '/api/status', '/api/stats', '/invite']
            });
        });

        // Error Handler
        this.app.use((err, req, res, next) => {
            console.error('[Web] Error:', err.message);
            res.status(500).json({ error: 'Internal Server Error' });
        });
    }

    start() {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(this.port, '0.0.0.0', () => {
                console.log('[Web] ╔════════════════════════════════════════╗');
                console.log(`[Web] ║  🌐 Web Server Online                  ║`);
                console.log(`[Web] ║  📍 Port: ${this.port}                        ║`);
                console.log(`[Web] ║  🔗 http://paloma.hidencloud.com:${this.port} ║`);
                console.log('[Web] ╚════════════════════════════════════════╝');
                resolve(this.server);
            }).on('error', (err) => {
                console.error('[Web] ❌ Server failed:', err.message);
                reject(err);
            });
        });
    }

    stop() {
        if (this.server) {
            this.server.close(() => {
                console.log('[Web] Server stopped');
            });
        }
    }
}

module.exports = WebServer;