const express = require('express');
const router = express.Router();

// Homepage
router.get('/', (req, res) => {
    const client = req.client;
    
    const data = {
        title: 'Aori Bot - Discord Music Bot',
        botName: client.user?.username || 'Aori Bot',
        botAvatar: client.user?.displayAvatarURL({ size: 256 }) || '',
        serverCount: client.guilds?.cache?.size || 0,
        userCount: client.guilds?.cache?.reduce((a, g) => a + g.memberCount, 0) || 0,
        uptime: client.uptime || 0,
        ping: client.ws?.ping || 0
    };
    
    // Cek apakah request minta JSON
    if (req.headers.accept?.includes('application/json')) {
        return res.json(data);
    }
    
    // Render HTML
    try {
        res.render('index', data);
    } catch (error) {
        // Fallback ke JSON jika template error
        console.error('[Web] Template error:', error.message);
        res.json(data);
    }
});

// Invite Bot
router.get('/invite', (req, res) => {
    const clientId = req.client.user?.id || process.env.CLIENT_ID;
    const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=66583920&scope=bot%20applications.commands`;
    res.redirect(inviteUrl);
});

// Support Server
router.get('/support', (req, res) => {
    const supportUrl = process.env.SUPPORT_SERVER || 'https://discord.gg/aori';
    res.redirect(supportUrl);
});

// Dashboard (placeholder)
router.get('/dashboard', (req, res) => {
    res.json({
        message: 'Dashboard coming soon!',
        status: 'development'
    });
});

module.exports = router;