export const BADGE_DEFINITIONS: Record<
    UserBadge,
    { icon: string; iconScale: number; i18nKey: string }
> = {
    developer: {
        icon: 'fluent-color:code-block-24',
        iconScale: 1.2,
        i18nKey: 'badges.developer',
    },
    contributor: {
        icon: 'fluent-color:animal-paw-print-24',
        iconScale: 1,
        i18nKey: 'badges.contributor',
    },
    translator: {
        icon: 'fluent-color:chat-multiple-24',
        iconScale: 1,
        i18nKey: 'badges.translator',
    },
    alpha_tester: {
        icon: 'fluent-color:ribbon-star-24',
        iconScale: 1,
        i18nKey: 'badges.alphaTester',
    },
    shop_owner: {
        icon: 'fluent-color:building-store-24',
        iconScale: 1,
        i18nKey: 'badges.shopOwner',
    },
    patrol: {
        icon: 'fluent-color:shield-24',
        iconScale: 1,
        i18nKey: 'badges.patrol',
    },
    idea_man: {
        icon: 'fluent-color:lightbulb-24',
        iconScale: 1,
        i18nKey: 'badges.ideaMan',
    },
}
