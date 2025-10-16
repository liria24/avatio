export default defineAppConfig({
    app: {
        name: 'Avatio',
        version: '1.2.6',
        site: 'https://avatio.me',
        repo: 'https://github.com/liria24/avatio',
        githubIssue: 'https://github.com/liria24/avatio/issues/new/choose',
        mailaddress: 'hello@avatio.me',
        liria: {
            website: 'https://liria.me',
            twitter: 'https://x.com/liria_24',
            avatar: 'https://github.com/liria24.png',
        },
    },
    itemCategory: {
        avatar: {
            label: 'ベースアバター',
            icon: 'lucide:person-standing',
        },
        hair: {
            label: 'ヘア',
            icon: 'mingcute:hair-line',
        },
        clothing: {
            label: '衣装',
            icon: 'lucide:shirt',
        },
        accessory: {
            label: 'アクセサリー',
            icon: 'mingcute:bow-tie-line',
        },
        texture: {
            label: 'テクスチャ',
            icon: 'lucide:image',
        },
        shader: {
            label: 'シェーダー',
            icon: 'mingcute:shadow-line',
        },
        tool: {
            label: 'ツール',
            icon: 'lucide:wrench',
        },
        other: {
            label: 'その他',
            icon: 'lucide:package',
        },
    },
    links: [
        {
            label: 'Avatio',
            pattern: /^(www\.)?avatio\.me$/,
            icon: 'avatio:avatio',
        },
        {
            label: 'Liria',
            pattern: /^(.*\.)?liria\.me$/,
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
    ],
    ui: {
        colors: {
            primary: 'zinc',
            neutral: 'zinc',
        },
        icons: {
            loading: 'svg-spinners:ring-resize',
        },
        accordion: {
            slots: {
                trigger: 'cursor-pointer',
                item: 'md:py-2',
            },
        },
        button: {
            slots: {
                base: 'cursor-pointer',
            },
            compoundVariants: [
                {
                    loading: true,
                    leading: true,
                    class: {
                        leadingIcon: 'animate-none',
                    },
                },
                {
                    loading: true,
                    leading: false,
                    trailing: true,
                    class: {
                        trailingIcon: 'animate-none',
                    },
                },
            ],
        },
        commandPalette: {
            slots: {
                item: 'cursor-pointer',
            },
            variants: {
                loading: {
                    true: {
                        itemLeadingIcon: 'animate-none',
                    },
                },
            },
        },
        contextMenu: {
            variants: {
                loading: {
                    true: {
                        itemLeadingIcon: 'animate-none',
                    },
                },
            },
        },
        dropdownMenu: {
            slots: {
                item: 'cursor-pointer',
            },
        },
        fileUpload: {
            slots: {
                base: 'cursor-pointer',
            },
        },
        input: {
            compoundVariants: [
                {
                    loading: true,
                    leading: true,
                    class: {
                        leadingIcon: 'animate-none',
                    },
                },
                {
                    loading: true,
                    leading: false,
                    trailing: true,
                    class: {
                        trailingIcon: 'animate-none',
                    },
                },
            ],
        },
        inputMenu: {
            compoundVariants: [
                {
                    loading: true,
                    leading: true,
                    class: {
                        leadingIcon: 'animate-none',
                    },
                },
                {
                    loading: true,
                    leading: false,
                    trailing: true,
                    class: {
                        trailingIcon: 'animate-none',
                    },
                },
            ],
        },
        inputTags: {
            compoundVariants: [
                {
                    loading: true,
                    leading: true,
                    class: {
                        leadingIcon: 'animate-none',
                    },
                },
                {
                    loading: true,
                    leading: false,
                    trailing: true,
                    class: {
                        trailingIcon: 'animate-none',
                    },
                },
            ],
        },
        navigationMenu: {
            slots: {
                link: 'cursor-pointer',
            },
            variants: {
                disabled: {
                    true: {
                        link: 'cursor-text',
                    },
                },
            },
        },
        select: {
            slots: {
                base: 'cursor-pointer',
            },
            compoundVariants: [
                {
                    loading: true,
                    leading: true,
                    class: {
                        leadingIcon: 'animate-none',
                    },
                },
                {
                    loading: true,
                    leading: false,
                    trailing: true,
                    class: {
                        trailingIcon: 'animate-none',
                    },
                },
            ],
        },
        selectMenu: {
            compoundVariants: [
                {
                    loading: true,
                    leading: true,
                    class: {
                        leadingIcon: 'animate-none',
                    },
                },
                {
                    loading: true,
                    leading: false,
                    trailing: true,
                    class: {
                        trailingIcon: 'animate-none',
                    },
                },
            ],
        },
        switch: {
            slots: {
                base: 'cursor-pointer',
                label: 'cursor-pointer',
            },
            variants: {
                loading: {
                    true: {
                        icon: 'animate-none',
                    },
                },
            },
        },
        tabs: {
            slots: {
                trigger: 'cursor-pointer',
            },
        },
        textarea: {
            compoundVariants: [
                {
                    loading: true,
                    leading: true,
                    class: {
                        leadingIcon: 'animate-none',
                    },
                },
                {
                    loading: true,
                    leading: false,
                    trailing: true,
                    class: {
                        trailingIcon: 'animate-none',
                    },
                },
            ],
        },
    },
})
