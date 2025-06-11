<script lang="ts" setup>
interface Props {
    user: Author
}
const props = defineProps<Props>()
</script>

<template>
    <Hovercard side="top" class="py-2.5 pr-4 pl-3">
        <template #trigger>
            <slot />
        </template>
        <template #content>
            <NuxtLink
                :to="{ name: '@id', params: { id: props.user.id } }"
                class="flex items-center gap-3"
            >
                <UiAvatar
                    :url="getImage(props.user.avatar, { prefix: 'avatar' })"
                    :alt="props.user.name"
                    :icon-size="18"
                    class="size-10"
                />
                <div class="flex flex-col gap-1.5">
                    <span
                        class="text-sm leading-none font-semibold text-zinc-700 dark:text-zinc-300"
                    >
                        {{ props.user.name }}
                    </span>
                    <BadgeUser :badges="props.user.badges" size="xs" />
                </div>
            </NuxtLink>
        </template>
    </Hovercard>
</template>
