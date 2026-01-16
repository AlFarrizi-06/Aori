const express = require('express');
const router = express.Router();
const os = require('os');

router.get('/', (req, res) => {
    const client = req.client;
    
    const stats = {
        // Bot Stats
        servers: client.guilds.cache.size,
        users: client.guilds.cache.reduce((a, g) => a + g.memberCount, 0),
        channels: client.channels.cache.size,
        uptime: formatUptime(client.uptime),
        ping: client.ws.ping,
        
        // System Stats
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        memoryUsage: formatBytes(process.memoryUsage().heapUsed),
        totalMemory: formatBytes(os.totalmem()),
        cpuUsage: os.loadavg()[0].toFixed(2)
    };
    
    // Check if requesting JSON
    if (req.headers.accept?.includes('application/json')) {
        return res.json(stats);
    }
    
    res.render('stats', {
        title: 'Statistics - Aori Bot',
        stats
    });
});

function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
}

function formatBytes(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

module.exports = router;