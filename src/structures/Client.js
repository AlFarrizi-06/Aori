const { Client, Collection, GatewayIntentBits, Partials, ActivityType } = require('discord.js');
const { Shoukaku, Connectors } = require('shoukaku');
const config = require('../../config/config');
const { emojis, colors } = require('../utils/constants');
const SpotifyManager = require('../utils/spotifyAPI');
const fs = require('fs');
const path = require('path');

class AoriClient extends Client {
    constructor() {
        super({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers,
            ],
            partials: [
                Partials.Channel,
                Partials.Message,
                Partials.User,
            ],
            allowedMentions: {
                parse: ['users', 'roles'],
                repliedUser: false,
            },
        });

        // Collections
        this.commands = new Collection();
        this.aliases = new Collection();
        this.cooldowns = new Collection();
        this.queue = new Collection();

        // Config
        this.config = config;
        this.customEmojis = emojis;
        this.embedColors = colors;
        this.prefix = config.bot.prefix;
        this.version = config.bot.version;

        // Current Track for RPC
        this.currentTrack = null;

        // Spotify Manager
        this.spotify = new SpotifyManager();

        // ✅ LAVALINK NODES CONFIGURATION
        const LavalinkNodes = [
            {
                name: 'Aori-Node-1',
                url: `${process.env.LAVALINK_HOST}:${process.env.LAVALINK_PORT}`,
                auth: process.env.LAVALINK_PASSWORD,
                secure: process.env.LAVALINK_SECURE === 'true',
            }
        ];

        // ✅ SHOUKAKU OPTIONS - FIXED RECONNECT
        this.shoukaku = new Shoukaku(new Connectors.DiscordJS(this), LavalinkNodes, {
            moveOnDisconnect: false,
            resume: true,
            resumeTimeout: 60,              // Resume timeout 60 detik
            resumeByLibrary: true,
            reconnectTries: -1,             // ✅ -1 = UNLIMITED RECONNECT ATTEMPTS
            reconnectInterval: 10000,       // ✅ 10 DETIK (dalam ms, bukan 5!)
            restTimeout: 60000,
            userAgent: 'Aori Music Bot v5.23.1',
            
            // ✅ NODE RESOLVER - Pilih node yang connected
            nodeResolver: (nodes) => {
                const availableNodes = [...nodes.values()].filter(n => n.state === 2);
                if (availableNodes.length === 0) return null;
                // Return node dengan penalties paling rendah
                return availableNodes.sort((a, b) => a.penalties - b.penalties)[0];
            }
        });

        // ✅ TRACK NODE RECONNECTING STATE
        this.nodeReconnecting = new Map();

        this.setupShoukakuEvents();
    }

    setupShoukakuEvents() {
        // ✅ NODE CONNECTED
        this.shoukaku.on('ready', (name) => {
            console.log(`[Aori] ✨ Lavalink Node "${name}" connected! (接続完了)`);
            
            // Clear reconnecting state
            this.nodeReconnecting.delete(name);
            
            // Restore players jika ada
            this.restorePlayers(name);
        });

        // ✅ NODE ERROR
        this.shoukaku.on('error', (name, error) => {
            console.error(`[Aori] ❌ Lavalink Node "${name}" error:`, error.message);
        });

        // ✅ NODE CLOSED - PENTING!
        this.shoukaku.on('close', (name, code, reason) => {
            console.warn(`[Aori] ⚠️ Lavalink Node "${name}" closed: ${code} - ${reason || 'No reason'}`);
            
            // Track reconnecting state
            if (!this.nodeReconnecting.has(name)) {
                this.nodeReconnecting.set(name, {
                    since: Date.now(),
                    attempts: 0
                });
            }
            
            const state = this.nodeReconnecting.get(name);
            state.attempts++;
            
            console.log(`[Aori] 🔄 Node "${name}" akan reconnect dalam 10 detik... (Attempt #${state.attempts})`);
        });

        // ✅ NODE DISCONNECT
        this.shoukaku.on('disconnect', (name, players, moved) => {
            console.log(`[Aori] 🔌 Node "${name}" disconnected. Moved: ${moved}`);
            
            // Jangan destroy queue, biarkan reconnect handle
            if (!moved) {
                console.log(`[Aori] 📦 Preserving ${this.queue.size} queue(s) for reconnection...`);
            }
        });

        // ✅ NODE RECONNECTING
        this.shoukaku.on('reconnecting', (name, reconnectsLeft, reconnectInterval) => {
            const state = this.nodeReconnecting.get(name) || { attempts: 0 };
            
            // reconnectsLeft akan -1 jika unlimited
            const triesText = reconnectsLeft === -1 ? '∞' : reconnectsLeft;
            
            console.log(`[Aori] 🔄 Reconnecting node "${name}"... (Tries left: ${triesText}, Interval: ${reconnectInterval}ms)`);
        });

        // ✅ DEBUG MODE
        this.shoukaku.on('debug', (name, info) => {
            if (process.env.DEBUG === 'true') {
                console.log(`[Aori Debug] ${name}: ${info}`);
            }
        });

        // ✅ RAW EVENT - Track lebih detail
        this.shoukaku.on('raw', (name, json) => {
            if (process.env.DEBUG === 'true') {
                console.log(`[Aori Raw] ${name}:`, json.op);
            }
        });
    }

    // ✅ RESTORE PLAYERS SETELAH RECONNECT
    async restorePlayers(nodeName) {
        if (this.queue.size === 0) return;
        
        console.log(`[Aori] 🔄 Attempting to restore ${this.queue.size} player(s)...`);
        
        for (const [guildId, queue] of this.queue) {
            try {
                // Check if player still exists
                const existingPlayer = this.shoukaku.players.get(guildId);
                
                if (!existingPlayer && queue.voiceChannel) {
                    console.log(`[Aori] 🎵 Restoring player for guild ${guildId}...`);
                    
                    // Recreate player
                    const node = this.getNode();
                    const player = await node.joinChannel({
                        guildId: guildId,
                        channelId: queue.voiceChannel.id,
                        shardId: 0,
                        deaf: true
                    });
                    
                    // Restore ke queue
                    queue.player = player;
                    queue.setupPlayerEvents();
                    
                    // Resume playing jika ada current track
                    if (queue.current) {
                        console.log(`[Aori] ▶️ Resuming: ${queue.current.title}`);
                        await queue.play();
                    }
                }
            } catch (error) {
                console.error(`[Aori] ❌ Failed to restore player for guild ${guildId}:`, error.message);
            }
        }
    }

    // ✅ GET NODE DENGAN FALLBACK
    getNode() {
        const node = this.shoukaku.options.nodeResolver(this.shoukaku.nodes);
        
        if (!node) {
            // Check if any node is reconnecting
            const reconnectingNodes = [...this.nodeReconnecting.keys()];
            if (reconnectingNodes.length > 0) {
                throw new Error(`Lavalink sedang reconnecting... Tunggu beberapa detik.`);
            }
            throw new Error('Tidak ada Lavalink node yang tersedia!');
        }
        
        return node;
    }

    // ✅ CHECK NODE STATUS
    isNodeAvailable() {
        try {
            const node = this.shoukaku.options.nodeResolver(this.shoukaku.nodes);
            return node !== null && node.state === 2; // 2 = CONNECTED
        } catch {
            return false;
        }
    }

    // ✅ GET NODE STATUS INFO
    getNodeStatus() {
        const nodes = [...this.shoukaku.nodes.values()];
        return nodes.map(node => ({
            name: node.name,
            state: node.state, // 0: CONNECTING, 1: NEARLY, 2: CONNECTED, 3: RECONNECTING, 4: DISCONNECTING, 5: DISCONNECTED
            stateText: ['CONNECTING', 'NEARLY', 'CONNECTED', 'RECONNECTING', 'DISCONNECTING', 'DISCONNECTED'][node.state] || 'UNKNOWN',
            players: node.players?.size || 0,
            reconnecting: this.nodeReconnecting.has(node.name)
        }));
    }

    async loadCommands() {
        const commandsPath = path.join(__dirname, '..', 'commands');
        
        if (!fs.existsSync(commandsPath)) {
            console.error('[Aori] ❌ Commands directory not found!');
            return;
        }

        const commandFolders = fs.readdirSync(commandsPath);

        for (const folder of commandFolders) {
            const folderPath = path.join(commandsPath, folder);
            
            if (!fs.statSync(folderPath).isDirectory()) continue;
            
            const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

            for (const file of commandFiles) {
                try {
                    const filePath = path.join(folderPath, file);
                    delete require.cache[require.resolve(filePath)];
                    const command = require(filePath);

                    if (command.name) {
                        this.commands.set(command.name, command);

                        if (command.aliases && Array.isArray(command.aliases)) {
                            command.aliases.forEach(alias => {
                                this.aliases.set(alias, command.name);
                            });
                        }

                        console.log(`[Aori] 📦 Loaded command: ${command.name}`);
                    }
                } catch (error) {
                    console.error(`[Aori] ❌ Failed to load command ${file}:`, error.message);
                }
            }
        }

        console.log(`[Aori] ✅ Loaded ${this.commands.size} commands!`);
    }

    async loadEvents() {
        const eventsPath = path.join(__dirname, '..', 'events');
        
        if (!fs.existsSync(eventsPath)) {
            console.error('[Aori] ❌ Events directory not found!');
            return;
        }

        const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

        for (const file of eventFiles) {
            try {
                const filePath = path.join(eventsPath, file);
                delete require.cache[require.resolve(filePath)];
                const event = require(filePath);

                if (event.once) {
                    this.once(event.name, (...args) => event.execute(...args, this));
                } else {
                    this.on(event.name, (...args) => event.execute(...args, this));
                }

                console.log(`[Aori] 🎯 Loaded event: ${event.name}`);
            } catch (error) {
                console.error(`[Aori] ❌ Failed to load event ${file}:`, error.message);
            }
        }
    }

    updatePresence() {
        if (!this.user) return;
        
        const playingGuilds = this.queue.filter(q => q.playing && q.current).size;
        
        if (playingGuilds > 0) {
            const statusText = playingGuilds === 1 
                ? `🎵 Playing in 1 server | a!help`
                : `🎵 Playing in ${playingGuilds} servers | a!help`;
            
            this.user.setPresence({
                activities: [{
                    name: statusText,
                    type: ActivityType.Listening,
                }],
                status: 'online',
            });
        } else {
            this.user.setPresence({
                activities: [{
                    name: `a!help | v${this.version}`,
                    type: ActivityType.Listening,
                }],
                status: 'online',
            });
        }
    }

    async start() {
        try {
            console.log('[Aori] 🚀 Starting Aori Music Bot...');
            
            await this.spotify.initialize();
            await this.loadCommands();
            await this.loadEvents();
            await this.login(this.config.bot.token);
        } catch (error) {
            console.error('[Aori] ❌ Failed to start:', error);
            process.exit(1);
        }
    }
}

module.exports = AoriClient;