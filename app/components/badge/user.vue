<script lang="ts" setup>
interface Props {
    badges?: Badge[];
    size?: 'xs' | 'sm' | 'md' | 'lg';
}
const props = withDefaults(defineProps<Props>(), {
    badges: () => [],
    size: 'md',
});

const getBaseSize = () => {
    if (props.size === 'xs') return 14;
    if (props.size === 'sm') return 16;
    if (props.size === 'lg') return 26;
    return 22;
};

const getIconSize = (multiplier: number) =>
    Math.round(getBaseSize() * multiplier);
</script>

<template>
    <div
        v-if="props.badges?.length"
        class="empty:hidden flex gap-1 items-center"
    >
        <UiTooltip
            v-if="props.badges.find((b) => b.name === 'developer')"
            text="デベロッパー"
        >
            <Icon name="fluent-color:code-block-24" :size="getIconSize(1.2)" />
        </UiTooltip>

        <UiTooltip
            v-if="props.badges.find((b) => b.name === 'contributor')"
            text="コントリビューター"
        >
            <Icon
                name="fluent-color:animal-paw-print-24"
                :size="getIconSize(1)"
            />
        </UiTooltip>

        <UiTooltip
            v-if="props.badges.find((b) => b.name === 'translator')"
            text="翻訳者"
        >
            <Icon name="fluent-color:chat-multiple-24" :size="getIconSize(1)" />
        </UiTooltip>

        <UiTooltip
            v-if="props.badges.find((b) => b.name === 'alpha_tester')"
            text="アルファテスター"
        >
            <Icon name="fluent-color:ribbon-star-24" :size="getIconSize(1)" />
        </UiTooltip>

        <UiTooltip
            v-if="props.badges.find((b) => b.name === 'shop_owner')"
            text="ショップオーナー"
        >
            <Icon
                name="fluent-color:building-store-24"
                :size="getIconSize(1)"
            />
        </UiTooltip>

        <UiTooltip
            v-if="props.badges.find((b) => b.name === 'patrol')"
            text="パトロール"
        >
            <Icon name="fluent-color:shield-24" :size="getIconSize(1)" />
        </UiTooltip>

        <UiTooltip
            v-if="props.badges.find((b) => b.name === 'idea_man')"
            text="アイデアマン"
        >
            <Icon name="fluent-color:lightbulb-24" :size="getIconSize(1)" />
        </UiTooltip>
    </div>
</template>
