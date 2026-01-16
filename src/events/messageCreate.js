const { EmbedBuilder, Collection } = require('discord.js');
const { emojis, colors } = require('../utils/constants');

module.exports = {
    name: 'messageCreate',
    once: false,

    async execute(message, client) {
        // Ignore bots
        if (message.author.bot) return;
        
        // Check for prefix (case-insensitive)
        const prefixLower = client.prefix.toLowerCase();
        const contentLower = message.content.toLowerCase();
        
        if (!contentLower.startsWith(prefixLower)) return;

        // Parse arguments
        const args = message.content.slice(client.prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        // Find command
        const command = client.commands.get(commandName) 
            || client.commands.get(client.aliases.get(commandName));

        if (!command) return;

        // Check cooldown (10 seconds)
        if (!client.cooldowns.has(command.name)) {
            client.cooldowns.set(command.name, new Collection());
        }

        const now = Date.now();
        const timestamps = client.cooldowns.get(command.name);
        const cooldownAmount = client.config.cooldown; // 10000ms = 10 seconds

        if (timestamps.has(message.author.id)) {
            const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                
                const cooldownEmbed = new EmbedBuilder()
                    .setColor(colors.warning)
                    .setDescription(`${emojis.warning} **Cooldown!** Please wait **${timeLeft.toFixed(1)}s** before using \`${command.name}\` again!\n(クールダウン中です。お待ちください)`)
                    .setFooter({ text: `Aori v${client.version}` });

                const msg = await message.reply({ embeds: [cooldownEmbed] });
                
                setTimeout(() => {
                    msg.delete().catch(() => {});
                }, 3000);
                
                return;
            }
        }

        timestamps.set(message.author.id, now);
        setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

        // Check if command requires voice channel
        if (command.voiceChannel) {
            if (!message.member.voice.channel) {
                const embed = new EmbedBuilder()
                    .setColor(colors.error)
                    .setDescription(`${emojis.error} You must be in a voice channel to use this command!\n(ボイスチャンネルに参加してください!)`)
                    .setFooter({ text: `Aori v${client.version}` });

                return message.reply({ embeds: [embed] });
            }

            // Check bot permissions
            const permissions = message.member.voice.channel.permissionsFor(message.guild.members.me);
            if (!permissions.has(['Connect', 'Speak'])) {
                const embed = new EmbedBuilder()
                    .setColor(colors.error)
                    .setDescription(`${emojis.error} I need **Connect** and **Speak** permissions!\n(接続と発言の権限が必要です!)`)
                    .setFooter({ text: `Aori v${client.version}` });

                return message.reply({ embeds: [embed] });
            }
        }

        // Check if command requires existing queue
        if (command.requireQueue) {
            const queue = client.queue.get(message.guild.id);
            if (!queue) {
                const embed = new EmbedBuilder()
                    .setColor(colors.error)
                    .setDescription(`${emojis.error} There is no music playing right now!\n(現在再生中の音楽がありません!)`)
                    .setFooter({ text: `Aori v${client.version}` });

                return message.reply({ embeds: [embed] });
            }
        }

        // Check same voice channel
        if (command.sameChannel) {
            const queue = client.queue.get(message.guild.id);
            if (queue && message.member.voice.channel?.id !== queue.voiceChannel.id) {
                const embed = new EmbedBuilder()
                    .setColor(colors.error)
                    .setDescription(`${emojis.error} You must be in the same voice channel as me!\n(同じボイスチャンネルにいる必要があります!)`)
                    .setFooter({ text: `Aori v${client.version}` });

                return message.reply({ embeds: [embed] });
            }
        }

        // Execute command
        try {
            await command.execute(message, args, client);
        } catch (error) {
            console.error(`[Aori] Error executing command ${command.name}:`, error);

            const errorEmbed = new EmbedBuilder()
                .setColor(colors.error)
                .setDescription(`${emojis.error} An error occurred while executing this command!\n(コマンド実行中にエラーが発生しました!)`)
                .setFooter({ text: `Error: ${error.message}` });

            message.reply({ embeds: [errorEmbed] }).catch(() => {});
        }
    }
};