<script lang="ts" setup></script>

<template>
    <Popup>
        <template #trigger>
            <slot />
        </template>

        <template #content>
            <NuxtLink
                v-if="userProfile?.id"
                :to="{ name: '@id', params: { id: userProfile.id } }"
                class="flex items-center gap-3"
            >
                <UiAvatar
                    :url="
                        useGetImage(userProfile.avatar, {
                            prefix: 'avatar',
                        })
                    "
                    :alt="userProfile.name ?? ''"
                    class="size-8"
                />
                <div class="flex flex-col gap-1.5">
                    <span
                        class="text-sm font-semibold leading-none text-zinc-700 dark:text-zinc-300"
                    >
                        {{ userProfile.name }}
                    </span>
                </div>
            </NuxtLink>
        </template>
    </Popup>
</template>
