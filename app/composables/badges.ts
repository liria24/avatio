export const useBadges = () => {
    const { t } = useI18n()

    const badgeDefinitions = computed<
        Record<UserBadge, { icon: string; iconScale: number; label: string }>
    >(() => ({
        developer: {
            icon: 'fluent-color:code-block-24',
            iconScale: 1.2,
            label: t('badges.developer'),
        },
        contributor: {
            icon: 'fluent-color:animal-paw-print-24',
            iconScale: 1,
            label: t('badges.contributor'),
        },
        translator: {
            icon: 'fluent-color:chat-multiple-24',
            iconScale: 1,
            label: t('badges.translator'),
        },
        alpha_tester: {
            icon: 'fluent-color:ribbon-star-24',
            iconScale: 1,
            label: t('badges.alphaTester'),
        },
        shop_owner: {
            icon: 'fluent-color:building-store-24',
            iconScale: 1,
            label: t('badges.shopOwner'),
        },
        patrol: {
            icon: 'fluent-color:shield-24',
            iconScale: 1,
            label: t('badges.patrol'),
        },
        idea_man: {
            icon: 'fluent-color:lightbulb-24',
            iconScale: 1,
            label: t('badges.ideaMan'),
        },
    }))

    return { badgeDefinitions }
}
