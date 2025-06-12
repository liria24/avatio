<script lang="ts" setup></script>

<template>
    <Popup class="gap-1 p-1">
        <template #trigger>
            <slot />
        </template>

        <template #content>
            <Button
                v-if="userProfile?.id"
                :to="{ name: '@id', params: { id: userProfile.id } }"
                variant="flat"
                class="py-2"
            >
                <UiAvatar
                    :url="
                        getImage(userProfile.avatar, {
                            prefix: 'avatar',
                        })
                    "
                    :alt="userProfile.name ?? ''"
                    class="size-8"
                />
                <span
                    class="text-sm leading-none font-semibold text-zinc-700 dark:text-zinc-300"
                >
                    {{ userProfile.name }}
                </span>
            </Button>
            <Button :to="{ name: 'settings' }" variant="flat" class="py-2">
                <Icon
                    name="lucide:bolt"
                    :size="20"
                    class="text-zinc-700 dark:text-zinc-300"
                />
                <span
                    class="text-sm leading-none font-semibold text-zinc-700 dark:text-zinc-300"
                >
                    設定
                </span>
            </Button>
            <Button variant="flat" class="py-2" @click="useSignOut">
                <Icon
                    name="lucide:log-out"
                    :size="20"
                    class="text-zinc-700 dark:text-zinc-300"
                />
                <span
                    class="text-sm leading-none font-semibold text-zinc-700 dark:text-zinc-300"
                >
                    ログアウト
                </span>
            </Button>
        </template>
    </Popup>
</template>
