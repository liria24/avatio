export default defineAppConfig({
    app: {
        name: 'Avatio',
        version: '1.5.0',
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
            icon: 'mingcute:baby-fill',
        },
        hair: {
            label: 'ヘア',
            icon: 'mingcute:hair-fill',
        },
        clothing: {
            label: '衣装',
            icon: 'mingcute:dress-fill',
        },
        accessory: {
            label: 'アクセサリー',
            icon: 'mingcute:bowknot-fill',
        },
        texture: {
            label: 'テクスチャ',
            icon: 'mingcute:pic-fill',
        },
        shader: {
            label: 'シェーダー',
            icon: 'mingcute:shadow-fill',
        },
        tool: {
            label: 'ツール',
            icon: 'mingcute:tool-fill',
        },
        other: {
            label: 'その他',
            icon: 'mingcute:package-2-fill',
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
            icon: 'mingcute:twitter-fill',
        },
        {
            label: 'X',
            pattern: /^(www\.)?x\.com$/,
            icon: 'mingcute:social-x-fill',
        },
        {
            label: 'Bluesky',
            pattern: /^(www\.)?bsky\.app$/,
            icon: 'mingcute:bluesky-social-fill',
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
            icon: 'mingcute:facebook-fill',
        },
        {
            label: 'Discord',
            pattern: /^(www\.)?discord(app)?\.com$/,
            icon: 'mingcute:discord-fill',
        },
        {
            label: 'Instagram',
            pattern: /^(www\.)?instagram\.com$/,
            icon: 'mingcute:instagram-fill',
        },
        {
            label: 'Threads',
            pattern: /^(www\.)?threads\.net$/,
            icon: 'mingcute:threads-fill',
        },
        {
            label: 'Pinterest',
            pattern: /^(www\.)?pinterest\.com$/,
            icon: 'mingcute:pinterest-fill',
        },
        {
            label: 'Reddit',
            pattern: /^(www\.)?reddit\.com$/,
            icon: 'mingcute:reddit-fill',
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
            icon: 'mingcute:youtube-fill',
        },
        {
            label: 'Twitch',
            pattern: /^(www\.)?twitch\.tv$/,
            icon: 'mingcute:twitch-fill',
        },
        {
            label: 'TikTok',
            pattern: /^(www\.)?tiktok\.com$/,
            icon: 'mingcute:tiktok-fill',
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
            icon: 'mingcute:bilibili-fill',
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
            icon: 'mingcute:spotify-fill',
        },
        {
            // Short link on Dub
            label: 'Spotify',
            pattern: /^spti\.fi$/,
            icon: 'mingcute:spotify-fill',
        },

        {
            label: 'BOOTH',
            pattern: /^(.*\.)?booth\.pm$/,
            icon: 'avatio:booth',
        },
        {
            label: 'GitHub',
            pattern: /^github\.com$/,
            icon: 'mingcute:github-fill',
        },
        {
            // Short link on Dub
            label: 'GitHub',
            pattern: /^git\.new$/,
            icon: 'mingcute:github-fill',
        },
        {
            label: 'Google',
            pattern: /^.*\.google\.com$/,
            icon: 'mingcute:google-fill',
        },
        {
            label: 'Steam',
            pattern: /^(www\.)?steamcommunity\.com$/,
            icon: 'mingcute:steam-fill',
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
            icon: 'mingcute:notion-fill',
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
            arrowDown: 'mingcute:arrow-down-line',
            arrowLeft: 'mingcute:arrow-left-line',
            arrowRight: 'mingcute:arrow-right-line',
            arrowUp: 'mingcute:arrow-up-line',
            caution: 'mingcute:warning-fill',
            check: 'mingcute:check-fill',
            chevronDoubleLeft: 'mingcute:arrows-left-line',
            chevronDoubleRight: 'mingcute:arrows-right-line',
            chevronDown: 'mingcute:down-line',
            chevronLeft: 'mingcute:left-line',
            chevronRight: 'mingcute:right-line',
            chevronUp: 'mingcute:up-line',
            close: 'mingcute:close-fill',
            copy: 'mingcute:copy-2-line',
            copyCheck: 'mingcute:copy-2-fill',
            dark: 'mingcute:moon-fill',
            drag: 'mingcute:dots-fill',
            ellipsis: 'mingcute:more-1-fill',
            error: 'mingcute:close-circle-fill',
            external: 'mingcute:arrow-right-up-line',
            eye: 'mingcute:eye-2-fill',
            eyeOff: 'mingcute:eye-close-fill',
            file: 'mingcute:file-fill',
            folder: 'mingcute:folder-fill',
            folderOpen: 'mingcute:folder-open-fill',
            hash: 'mingcute:hashtag-fill',
            info: 'mingcute:information-fill',
            light: 'mingcute:sun-fill',
            menu: 'mingcute:menu-fill',
            minus: 'mingcute:minimize-fill',
            panelClose: 'mingcute:layout-leftbar-close-fill',
            panelOpen: 'mingcute:layout-leftbar-open-fill',
            plus: 'mingcute:add-fill',
            reload: 'mingcute:refresh-2-fill',
            search: 'mingcute:search-line',
            stop: 'mingcute:square-fill',
            success: 'mingcute:check-circle-fill',
            system: 'mingcute:monitor-fill',
            tip: 'mingcute:bulb-2-fill',
            upload: 'mingcute:upload-fill',
            warning: 'mingcute:alert-fill',
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
