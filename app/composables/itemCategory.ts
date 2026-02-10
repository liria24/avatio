export const useItemCategory = () => {
    const { t } = useI18n()

    return {
        avatar: {
            label: t('itemCategory.avatar'),
            icon: 'mingcute:baby-fill',
        },
        hair: {
            label: t('itemCategory.hair'),
            icon: 'mingcute:hair-fill',
        },
        clothing: {
            label: t('itemCategory.clothing'),
            icon: 'mingcute:dress-fill',
        },
        accessory: {
            label: t('itemCategory.accessory'),
            icon: 'mingcute:bowknot-fill',
        },
        texture: {
            label: t('itemCategory.texture'),
            icon: 'mingcute:pic-fill',
        },
        shader: {
            label: t('itemCategory.shader'),
            icon: 'mingcute:shadow-fill',
        },
        tool: {
            label: t('itemCategory.tool'),
            icon: 'mingcute:tool-fill',
        },
        other: {
            label: t('itemCategory.other'),
            icon: 'mingcute:package-2-fill',
        },
    }
}
