<script lang="ts" setup>
interface Props {
    badges?: { badge: UserBadge; createdAt: string }[]
    size?: 'xs' | 'sm' | 'md' | 'lg'
}
const props = withDefaults(defineProps<Props>(), {
    badges: () => [],
    size: 'md',
})

const getBaseSize = () => {
    if (props.size === 'xs') return 14
    if (props.size === 'sm') return 16
    if (props.size === 'lg') return 26
    return 20
}

const getIconSize = (multiplier: number) => Math.round(getBaseSize() * multiplier)

const badgeEntries = Object.entries(BADGE_DEFINITIONS) as Array<
    [UserBadge, (typeof BADGE_DEFINITIONS)[UserBadge]]
>
</script>

<template>
    <div v-if="props.badges?.length" class="flex items-center gap-1 empty:hidden">
        <template v-for="[id, def] in badgeEntries" :key="id">
            <UTooltip
                v-if="props.badges.some((b) => b.badge === id)"
                :text="$t(def.i18nKey)"
                :delay-duration="50"
            >
                <Icon :name="def.icon" :size="getIconSize(def.iconScale)" />
            </UTooltip>
        </template>
    </div>
</template>
