<script lang="ts" setup>
interface Props {
    user: Author;
}
const props = defineProps<Props>();
</script>

<template>
    <Hovercard side="top" class="pl-3 pr-4 py-2.5">
        <template #trigger>
            <slot />
        </template>
        <template #content>
            <NuxtLink
                :to="{ name: '@id', params: { id: props.user.id } }"
                class="flex items-center gap-3"
            >
                <UiAvatar
                    :url="useGetImage(props.user.avatar, { prefix: 'avatar' })"
                    :alt="props.user.name"
                    :icon-size="18"
                    class="size-10"
                />
                <div class="flex flex-col gap-1.5">
                    <span
                        class="text-sm font-semibold leading-none text-zinc-700 dark:text-zinc-300"
                    >
                        {{ props.user.name }}
                    </span>
                    <BadgeUser :badges="props.user.badges" size="xs" />
                </div>
            </NuxtLink>
        </template>
    </Hovercard>
</template>
