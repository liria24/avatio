<script setup lang="ts">
interface Props {
    title: string
}
const { title } = defineProps<Props>()

const openSidebar = ref(true)
</script>

<template>
    <div class="flex w-full flex-1 gap-6">
        <USidebar
            v-model:open="openSidebar"
            :ui="{
                header: 'lg:min-h-fit lg:pb-4',
                container: 'h-full relative w-full border-0',
            }"
        >
            <template #header>
                <h1 class="text-xl leading-none font-bold">{{ $t('settings.title') }}</h1>
            </template>

            <UNavigationMenu
                :items="[
                    [
                        {
                            to: $localePath('/settings'),
                            label: $t('settings.general.title'),
                            icon: 'mingcute:settings-1-fill',
                        },
                        {
                            to: $localePath('/settings/shops'),
                            label: $t('settings.shop.title'),
                            icon: 'mingcute:shop-fill',
                        },
                        {
                            to: $localePath('/settings/account'),
                            label: $t('settings.account.title'),
                            icon: 'mingcute:safe-lock-fill',
                        },
                        {
                            to: $localePath('/settings/notifications'),
                            label: '通知',
                            icon: 'mingcute:notification-fill',
                        },
                    ],
                ]"
                orientation="vertical"
                tooltip
                popover
                color="neutral"
                :ui="{
                    link: 'gap-2.5 text-toned tracking-wide',
                    linkLeadingIcon: 'size-4.25 text-toned',
                }"
            />
        </USidebar>

        <div class="flex w-full flex-col gap-10">
            <div class="flex shrink-0 items-center gap-2">
                <UButton
                    :aria-label="$t('settings.toggleSidebar')"
                    icon="mingcute:layout-leftbar-open-fill"
                    color="neutral"
                    variant="ghost"
                    class="lg:hidden"
                    @click="openSidebar = !openSidebar"
                />

                <h2 class="text-xl leading-none font-bold">{{ title }}</h2>
            </div>

            <slot />
        </div>
    </div>
</template>
