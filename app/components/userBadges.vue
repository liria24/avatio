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
</script>

<template>
    <div v-if="props.badges?.length" class="flex items-center gap-1 empty:hidden">
        <UTooltip
            v-if="props.badges.find((b) => b.badge === 'developer')"
            text="デベロッパー"
            :delay-duration="50"
        >
            <Icon name="fluent-color:code-block-24" :size="getIconSize(1.2)" />
        </UTooltip>

        <UTooltip
            v-if="props.badges.find((b) => b.badge === 'contributor')"
            text="コントリビューター"
            :delay-duration="50"
        >
            <Icon name="fluent-color:animal-paw-print-24" :size="getIconSize(1)" />
        </UTooltip>

        <UTooltip
            v-if="props.badges.find((b) => b.badge === 'translator')"
            text="翻訳者"
            :delay-duration="50"
        >
            <Icon name="fluent-color:chat-multiple-24" :size="getIconSize(1)" />
        </UTooltip>

        <UTooltip
            v-if="props.badges.find((b) => b.badge === 'alpha_tester')"
            text="アルファテスター"
            :delay-duration="50"
        >
            <Icon name="fluent-color:ribbon-star-24" :size="getIconSize(1)" />
        </UTooltip>

        <UTooltip
            v-if="props.badges.find((b) => b.badge === 'shop_owner')"
            text="ショップオーナー"
            :delay-duration="50"
        >
            <Icon name="fluent-color:building-store-24" :size="getIconSize(1)" />
        </UTooltip>

        <UTooltip
            v-if="props.badges.find((b) => b.badge === 'patrol')"
            text="パトロール"
            :delay-duration="50"
        >
            <Icon name="fluent-color:shield-24" :size="getIconSize(1)" />
        </UTooltip>

        <UTooltip
            v-if="props.badges.find((b) => b.badge === 'idea_man')"
            text="アイデアマン"
            :delay-duration="50"
        >
            <Icon name="fluent-color:lightbulb-24" :size="getIconSize(1)" />
        </UTooltip>
    </div>
</template>
