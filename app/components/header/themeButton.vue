<script setup lang="ts">
const { t } = useI18n()
const colorMode = useColorMode()
</script>

<template>
    <ClientOnly>
        <UDropdownMenu
            :items="[
                {
                    label: t('system'),
                    icon: 'mingcute:monitor-fill',
                    onSelect: () => {
                        colorMode.preference = 'system'
                    },
                },
                {
                    label: t('light'),
                    icon: 'mingcute:sun-fill',
                    onSelect: () => {
                        colorMode.preference = 'light'
                    },
                },
                {
                    label: t('dark'),
                    icon: 'mingcute:moon-fill',
                    onSelect: () => {
                        colorMode.preference = 'dark'
                    },
                },
            ]"
            :content="{
                align: 'center',
                side: 'bottom',
                sideOffset: 8,
            }"
        >
            <UTooltip :text="t('theme')" :delay-duration="50">
                <UButton
                    :icon="colorMode.value === 'dark' ? 'mingcute:moon-fill' : 'mingcute:sun-fill'"
                    :aria-label="t('theme')"
                    variant="ghost"
                />
            </UTooltip>
        </UDropdownMenu>

        <template #fallback>
            <UButton icon="mingcute:palette-fill" :aria-label="t('theme')" variant="ghost" />
        </template>
    </ClientOnly>
</template>
