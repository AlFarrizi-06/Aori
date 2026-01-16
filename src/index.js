require('dotenv').config();

const AoriClient = require('./structures/Client');
const WebServer = require('./web/server');

const client = new AoriClient();
let webServer = null;

// Handle errors
process.on('unhandledRejection', (error) => {
    console.error('[Aori] Unhandled Rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('[Aori] Uncaught Exception:', error);
});

// Handle shutdown
process.on('SIGINT', () => {
    console.log('\n[Aori] Shutting down gracefully... さようなら!');
    
    // Stop web server
    if (webServer) {
        webServer.stop();
        console.log('[Aori] Web server stopped');
    }
    
    // Destroy all queues
    if (client.queue) {
        client.queue.forEach(queue => {
            queue.destroy();
        });
    }
    
    client.destroy();
    process.exit(0);
});

// Handle SIGTERM (untuk hosting seperti Railway, Heroku)
process.on('SIGTERM', () => {
    console.log('\n[Aori] Received SIGTERM, shutting down...');
    
    if (webServer) {
        webServer.stop();
    }
    
    if (client.queue) {
        client.queue.forEach(queue => {
            queue.destroy();
        });
    }
    
    client.destroy();
    process.exit(0);
});

// Start web server when bot is ready
client.once('ready', async () => {
    try {
        webServer = new WebServer(client);
        await webServer.start();
        
        console.log('[Aori] ════════════════════════════════════════');
        console.log('[Aori] ✅ Bot and Web Server are fully ready!');
        console.log(`[Aori] 🌐 Dashboard: http://localhost:${process.env.PORT || 3000}`);
        console.log(`[Aori] 📊 API: http://localhost:${process.env.PORT || 3000}/api/status`);
        console.log('[Aori] ════════════════════════════════════════');
    } catch (error) {
        console.error('[Aori] Failed to start web server:', error);
    }
});

// Start the bot
client.start();