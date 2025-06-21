export default defineAppConfig({
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
