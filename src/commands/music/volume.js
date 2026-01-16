const { EmbedBuilder } = require('discord.js');
const { emojis, colors } = require('../../utils/constants');

module.exports = {
    name: 'volume',
    aliases: ['vol', 'v'],
    description: 'Set the volume (0-100) (音量)',
    usage: 'a!volume <0-100>',
    category: 'music',
    voiceChannel: true,
    requireQueue: true,
    sameChannel: true,

    async execute(message, args, client) {
        const queue = client.queue.get(message.guild.id);

        if (!args[0]) {
            const volumeBar = createVolumeBar(queue.volume);
            
            const embed = new EmbedBuilder()
                .setColor(colors.info)
                .setDescription(`${emojis.volume} Current volume: **${queue.volume}%**\n${volumeBar}`)
                .setFooter({ text: 'Usage: a!volume <0-100> | Aori v' + client.version });

            return message.reply({ embeds: [embed] });
        }

        const volume = parseInt(args[0]);

        if (isNaN(volume) || volume < 0 || volume > 100) {
            const embed = new EmbedBuilder()
                .setColor(colors.error)
                .setDescription(`${emojis.error} Volume must be between **0** and **100**!\n(音量は0から100の間で設定してください!)`)
                .setFooter({ text: `Aori v${client.version}` });

            return message.reply({ embeds: [embed] });
        }

        await queue.setVolume(volume);
        const volumeBar = createVolumeBar(volume);

        const volumeEmoji = volume === 0 ? emojis.volume_mute : emojis.volume;

        const embed = new EmbedBuilder()
            .setColor(colors.success)
            .setDescription(`${volumeEmoji} Volume set to **${volume}%**\n${volumeBar}\n(音量を${volume}%に設定しました!)`)
            .setFooter({ text: `Aori v${client.version}` })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }
};

function createVolumeBar(volume, length = 10) {
    const filled = Math.round((volume / 100) * length);
    const empty = length - filled;

    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}