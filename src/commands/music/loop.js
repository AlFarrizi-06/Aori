const { EmbedBuilder } = require('discord.js');
const { emojis, colors } = require('../../utils/constants');

module.exports = {
    name: 'loop',
    aliases: ['l', 'repeat', 'lp'],
    description: 'Toggle loop mode (ループ)',
    usage: 'a!loop [off/track/queue]',
    category: 'music',
    voiceChannel: true,
    requireQueue: true,
    sameChannel: true,

    async execute(message, args, client) {
        const queue = client.queue.get(message.guild.id);
        const mode = args[0]?.toLowerCase();

        let newMode;
        let modeText;
        let modeEmoji;

        if (mode === 'off' || mode === 'none' || mode === 'disable') {
            newMode = 'none';
            modeText = 'Disabled / 無効';
            modeEmoji = '❌';
        } else if (mode === 'track' || mode === 'song' || mode === 'one' || mode === '1') {
            newMode = 'track';
            modeText = 'Track Loop / 曲ループ 🔂';
            modeEmoji = '🔂';
        } else if (mode === 'queue' || mode === 'all' || mode === 'q') {
            newMode = 'queue';
            modeText = 'Queue Loop / キューループ 🔁';
            modeEmoji = '🔁';
        } else {
            // Cycle through modes if no argument
            if (queue.loop === 'none') {
                newMode = 'track';
                modeText = 'Track Loop / 曲ループ 🔂';
                modeEmoji = '🔂';
            } else if (queue.loop === 'track') {
                newMode = 'queue';
                modeText = 'Queue Loop / キューループ 🔁';
                modeEmoji = '🔁';
            } else {
                newMode = 'none';
                modeText = 'Disabled / 無効';
                modeEmoji = '❌';
            }
        }

        queue.setLoop(newMode);

        const embed = new EmbedBuilder()
            .setColor(colors.success)
            .setDescription(`${modeEmoji} Loop mode set to: **${modeText}**`)
            .addFields({
                name: 'Available Modes / 利用可能なモード',
                value: '`off` - Disable loop\n`track` - Loop current track 🔂\n`queue` - Loop entire queue 🔁'
            })
            .setFooter({ text: `Aori v${client.version}` })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }
};