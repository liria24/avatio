export default defineAppConfig({
    ui: {
        colors: {
            primary: 'zinc',
            neutral: 'zinc',
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
        },
        dropdownMenu: {
            slots: {
                item: 'cursor-pointer',
            },
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
        tabs: {
            slots: {
                trigger: 'cursor-pointer',
            },
        },
    },
})
