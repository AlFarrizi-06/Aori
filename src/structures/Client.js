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

        // Initialize Shoukaku (Lavalink)
        const LavalinkNodes = [
            {
                name: 'Aori-Node-1',
                url: `${process.env.LAVALINK_HOST}:${process.env.LAVALINK_PORT}`,
                auth: process.env.LAVALINK_PASSWORD,
                secure: process.env.LAVALINK_SECURE === 'true',
            }
        ];

        this.shoukaku = new Shoukaku(new Connectors.DiscordJS(this), LavalinkNodes, {
            moveOnDisconnect: false,
            resume: true,
            resumeTimeout: 30,
            resumeByLibrary: true,
            reconnectTries: 5,
            reconnectInterval: 5,
            restTimeout: 60000,
            userAgent: 'Aori Music Bot v5.23.1',
        });

        this.setupShoukakuEvents();
    }

    setupShoukakuEvents() {
        this.shoukaku.on('ready', (name) => {
            console.log(`[Aori] ✨ Lavalink Node "${name}" connected! (接続完了)`);
        });

        this.shoukaku.on('error', (name, error) => {
            console.error(`[Aori] ❌ Lavalink Node "${name}" error:`, error);
        });

        this.shoukaku.on('close', (name, code, reason) => {
            console.warn(`[Aori] ⚠️ Lavalink Node "${name}" closed: ${code} - ${reason}`);
        });

        this.shoukaku.on('disconnect', (name, players, moved) => {
            if (moved) return;
            players.forEach(player => {
                const guildId = player.guildId;
                const queue = this.queue.get(guildId);
                if (queue) queue.destroy();
            });
            console.log(`[Aori] 🔌 Node "${name}" disconnected`);
        });

        this.shoukaku.on('debug', (name, info) => {
            if (process.env.DEBUG === 'true') {
                console.log(`[Aori Debug] ${name}: ${info}`);
            }
        });
    }

    getNode() {
        const node = this.shoukaku.options.nodeResolver(this.shoukaku.nodes);
        if (!node) throw new Error('No Lavalink nodes available');
        return node;
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

    updatePresence(track = null) {
        if (!this.user) return;
        
        if (track) {
            this.currentTrack = track;
            const statusText = `🎵 ${track.info.author} - ${track.info.title}`.substring(0, 128);
            
            this.user.setPresence({
                activities: [{
                    name: statusText,
                    type: ActivityType.Listening,
                }],
                status: 'online',
            });
            
            console.log(`[Aori] 🎵 Rich Presence updated: ${statusText}`);
        } else {
            this.currentTrack = null;
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
            
            // Initialize Spotify API
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
