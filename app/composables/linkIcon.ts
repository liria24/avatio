import { parseURL } from 'ufo';

interface IconMapping {
    label: string;
    pattern: RegExp;
    icon: string;
    iconSize?: number;
}

const domainIconMappings: IconMapping[] = [
    {
        label: 'Avatio',
        pattern: /^(www\.)?avatio\.me$/,
        icon: 'avatio:avatio',
    },
    {
        label: 'Liria',
        pattern: /^(.*\.)?liria\.work$/,
        icon: 'avatio:liria',
    },

    // VR-SNS
    {
        label: 'VRChat',
        pattern: /^(.*\.)?vrchat\.com$/,
        icon: 'simple-icons:vrchat',
        iconSize: 38,
    },

    // Social
    {
        label: 'Twitter',
        pattern: /^(www\.)?twitter\.com$/,
        icon: 'simple-icons:twitter',
    },
    {
        label: 'X',
        pattern: /^(www\.)?x\.com$/,
        icon: 'simple-icons:x',
    },
    {
        label: 'Bluesky',
        pattern: /^(www\.)?bsky\.app$/,
        icon: 'simple-icons:bluesky',
    },
    {
        // mixi.jp -> mixi
        // mixi.social -> mixi 2
        label: 'mixi',
        pattern: /^(.*\.)?mixi\.(jp|social)$/,
        icon: 'entypo-social:mixi',
    },
    {
        label: 'Facebook',
        pattern: /^(www\.)?facebook\.com$/,
        icon: 'simple-icons:facebook',
    },
    {
        label: 'Discord',
        pattern: /^(www\.)?discord(app)?\.com$/,
        icon: 'simple-icons:discord',
    },
    {
        label: 'Instagram',
        pattern: /^(www\.)?instagram\.com$/,
        icon: 'simple-icons:instagram',
    },
    {
        label: 'Threads',
        pattern: /^(www\.)?threads\.net$/,
        icon: 'simple-icons:threads',
    },
    {
        label: 'Pinterest',
        pattern: /^(www\.)?pinterest\.com$/,
        icon: 'simple-icons:pinterest',
    },
    {
        label: 'Reddit',
        pattern: /^(www\.)?reddit\.com$/,
        icon: 'simple-icons:reddit',
    },
    {
        label: 'Tumblr',
        pattern: /^(www\.)?tumblr\.com$/,
        icon: 'simple-icons:tumblr',
    },

    // Media
    {
        label: 'YouTube',
        pattern: /^(www\.)?youtube\.com$/,
        icon: 'simple-icons:youtube',
    },
    {
        label: 'Twitch',
        pattern: /^(www\.)?twitch\.tv$/,
        icon: 'simple-icons:twitch',
    },
    {
        label: 'TikTok',
        pattern: /^(www\.)?tiktok\.com$/,
        icon: 'simple-icons:tiktok',
    },
    {
        label: 'Vimeo',
        pattern: /^(www\.)?vimeo\.com$/,
        icon: 'simple-icons:vimeo',
    },
    {
        label: 'Niconico',
        pattern: /^(www\.)?nicovideo\.jp$/,
        icon: 'simple-icons:niconico',
    },
    {
        label: 'Bilibili',
        pattern: /^(www\.)?bilibili\.com$/,
        icon: 'simple-icons:bilibili',
    },
    {
        label: 'Pixiv',
        pattern: /^(www\.)?pixiv\.net$/,
        icon: 'simple-icons:pixiv',
    },
    {
        label: 'ArtStation',
        pattern: /^(.*\.)?artstation\.com$/,
        icon: 'simple-icons:artstation',
    },
    {
        label: 'SoundCloud',
        pattern: /^(m\.)?soundcloud\.com$/,
        icon: 'simple-icons:soundcloud',
    },
    {
        label: 'Spotify',
        pattern: /^(open\.)?spotify\.com$/,
        icon: 'simple-icons:spotify',
    },
    {
        // Short link on Dub
        label: 'Spotify',
        pattern: /^spti\.fi$/,
        icon: 'simple-icons:spotify',
    },

    {
        label: 'BOOTH',
        pattern: /^(.*\.)?booth\.pm$/,
        icon: 'avatio:booth',
    },
    {
        label: 'GitHub',
        pattern: /^github\.com$/,
        icon: 'simple-icons:github',
    },
    {
        // Short link on Dub
        label: 'GitHub',
        pattern: /^git\.new$/,
        icon: 'simple-icons:github',
    },
    {
        label: 'Google',
        pattern: /^.*\.google\.com$/,
        icon: 'simple-icons:google',
    },
    {
        label: 'Steam',
        pattern: /^(www\.)?steamcommunity\.com$/,
        icon: 'simple-icons:steam',
    },
    {
        label: 'Patreon',
        pattern: /^(www\.)?patreon\.com$/,
        icon: 'simple-icons:patreon',
    },
    {
        label: 'Amazon',
        pattern:
            /^(www\.)?amazon\.(com|jp|co.jp|com.au|com.br|ca|fr|de|in|it|com.mx|nl|sg|es|com.tr|ae|co.uk|cn)$/,
        icon: 'simple-icons:amazon',
    },
    {
        // Short link on Dub
        label: 'Amazon',
        pattern: /^amzn\.id$/,
        icon: 'simple-icons:amazon',
    },
    {
        label: 'Notion',
        pattern: /^(.*\.)?notion\.site$/,
        icon: 'simple-icons:notion',
    },
    {
        label: 'Skeb',
        pattern: /^(www\.)?skeb\.jp$/,
        icon: 'token:skeb',
    },
];

export const getLinkInfo = (url: string) => {
    const parsed = parseURL(url);
    if (!parsed.host) return { label: null, icon: 'lucide:link', iconSize: 20 };

    const host = parsed.host.toLowerCase();
    const mapping = domainIconMappings.find((m) => m.pattern.test(host));

    return {
        label: mapping?.label || null,
        icon: mapping?.icon || 'lucide:link',
        iconSize: mapping?.iconSize || 20,
    };
};
