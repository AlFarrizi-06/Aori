// Aori v5.23.1 Custom Emojis
// Replace with your actual emoji IDs

module.exports = {
    // Main Emojis
    emojis: {
        // Loading & Status
        loading: '<a:loading:1460107125735817398>',
        loading_bar: '<a:aori_loadbar:1234567891>',
        success: '<:success:1460102993440407713>',
        error: '<:Error:1460102530305360018>',
        warning: '<a:warning:1460102705010966528>',
        info: '<:info:1460102677970157620>',

        // Music Controls
        play: '<:PlayButton:1460142992349331529>',
        pause: '<:PauseButton:1460142990449315880>',
        stop: '<:StopButton:1460197340345270394>',
        skip: '<:NextButton:1460142988704485489>',
        previous: '<:PreviousButton:1460142985957085225>',
        shuffle: '<:ShuffleButton:1460142997273444497>',
        loop: '<:RepeatButton:1460142994928828426>',
        loop_one: '<:RepeatButton:1460142994928828426>',
        queue: '<:Queue:1460193453164986459>',
        volume: '<:volumehigh:1460108537349931109>',
        volume_mute: '<:volumemute:1460108541204365575>',
        music: '<:music76:1460549516552835136>',
        disc: '<a:cd:1460109476144091137>',
        headphone: '<:headphones:1460996842417553479>',

        // Platform Emojis
        deezer: '<:deezer:1459943659691573434>',
        soundcloud: '<:soundcloud:1459943662581715097>',
        spotify: '<:spotify:1459943664678604862>',
        bandcamp: '<:bandcamp:1460310207602098435>',
        applemusic: '<:applemusic:1459943658022244393>',
        link: '<:playbutton:1461034373255008290>',

        // Progress Bar
        bar_start_full: '<:aori_bs_f:1234567915>',
        bar_start_empty: '<:aori_bs_e:1234567916>',
        bar_mid_full: '<:aori_bm_f:1234567917>',
        bar_mid_empty: '<:aori_bm_e:1234567918>',
        bar_end_full: '<:aori_be_f:1234567919>',
        bar_end_empty: '<:aori_be_e:1234567920>',

        // Kawaii/Anime
        star: '<:star:1460549713185996947>',
        sparkle: '<:sparkle:1460549746254155818>',
        heart: '<a:heart:1460549644151947315>',
        sakura: '<:purplesakuraflower:1460997921066451055>',
        neko: '<a:Animegirl:1460312909438783498>',
        anime: '<a:Anime:1460312911711961118>',
        cool: '<a:waguri:1460997670289276978>',

        // Misc
        arrow_right: '<a:arrow:1460997155992113213>',
        clock: '<:time:1460998105422889073>',
        user: '<:user:1460998107725697034>',
        server: '<:server:1460998180333420688>',
        ping: '<a:online:1460998271605412001>',
        bot: '<a:thinking:1460574147510927430>',
    },

    // Loading Messages (English with Japanese)
    loadingMessages: {
        searching: '🔍 Searching for your song... (検索中...)',
        searchingPlatform: (platform) => `Searching on **${platform}**... (${platform}で検索中...)`,
        loadingTrack: 'Loading track... (曲を読み込み中...)',
        loadingPlaylist: '📁 Loading playlist... (プレイリストを読み込み中...)',
        connecting: '🔌 Connecting to voice channel... (接続中...)',
        processing: '⚙️ Processing your request... (処理中...)',
        fetching: '📥 Fetching data... (データ取得中...)',
        addingToQueue: '➕ Adding to queue... (キューに追加中...)',
        platformFallback: (from, to) => `Not found on **${from}**, trying **${to}**...`,
    },

    // Colors
    colors: {
        primary: 0xFF69B4,     // Pink
        success: 0x00FF7F,     // Spring Green
        error: 0xFF4444,       // Red
        warning: 0xFFAA00,     // Orange
        info: 0x00BFFF,        // Deep Sky Blue
        music: 0xFF1493,       // Deep Pink
        queue: 0x9400D3,       // Dark Violet
        dark: 0x2F3136,        // Dark (for unknown links)
        deezer: 0xFEAA2D,
        soundcloud: 0xFF5500,
        spotify: 0x1DB954,
        bandcamp: 0x629AA9,
        applemusic: 0xFC3C44,
    },

    // Fallback emojis (if custom not available)
    fallbackEmojis: {
        loading: '⏳',
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️',
        play: '▶️',
        pause: '⏸️',
        stop: '⏹️',
        skip: '⏭️',
        music: '🎵',
        queue: '📜',
        volume: '🔊',
        link: '🔗',
    }
};