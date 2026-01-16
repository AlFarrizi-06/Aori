const { EmbedBuilder } = require('discord.js');
const { emojis, colors } = require('../../utils/constants');

module.exports = {
    name: 'grab',
    aliases: ['save', 'dm'],
    description: 'Save current song info to DM (曲情報をDMに保存)',
    usage: 'a!grab',
    category: 'music',
    requireQueue: true,

    async execute(message, args, client) {
        const queue = client.queue.get(message.guild.id);

        if (!queue.current) {
            const embed = new EmbedBuilder()
                .setColor(colors.error)
                .setDescription(`${emojis.error} Nothing is playing right now!\n(現在再生中の曲がありません!)`)
                .setFooter({ text: `Aori v${client.version}` });

            return message.reply({ embeds: [embed] });
        }

        const track = queue.current;

        const dmEmbed = new EmbedBuilder()
            .setColor(colors.music)
            .setAuthor({
                name: 'Saved Song / 保存した曲 ♪',
                iconURL: client.user.displayAvatarURL(),
            })
            .setTitle(`${emojis.music} ${track.info.title}`)
            .setURL(track.info.uri)
            .setThumbnail(track.info.artworkUrl || client.user.displayAvatarURL())
            .addFields(
                { name: 'Artist / アーティスト', value: track.info.author, inline: true },
                { name: 'Duration / 長さ', value: formatDuration(track.info.length), inline: true },
                { name: 'Link / リンク', value: `[Click here](${track.info.uri})`, inline: true },
                { name: 'Server / サーバー', value: message.guild.name, inline: true }
            )
            .setFooter({ text: `Saved from ${message.guild.name} | Aori v${client.version}` })
            .setTimestamp();

        try {
            await message.author.send({ embeds: [dmEmbed] });

            const embed = new EmbedBuilder()
                .setColor(colors.success)
                .setDescription(`${emojis.success} Song info sent to your DMs!\n(DMに曲情報を送信しました!)`)
                .setFooter({ text: `Aori v${client.version}` });

            message.reply({ embeds: [embed] });

        } catch (error) {
            const embed = new EmbedBuilder()
                .setColor(colors.error)
                .setDescription(`${emojis.error} Couldn't send DM! Please enable DMs from server members.\n(DMを送信できませんでした!)`)
                .setFooter({ text: `Aori v${client.version}` });

            message.reply({ embeds: [embed] });
        }
    }
};

function formatDuration(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}