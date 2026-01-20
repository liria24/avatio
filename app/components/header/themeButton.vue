<script setup lang="ts">
const colorMode = useColorMode()

const themeMenu = [
    {
        label: 'システム',
        icon: 'mingcute:monitor-fill',
        onSelect: () => {
            colorMode.preference = 'system'
        },
    },
    {
        label: 'ライト',
        icon: 'mingcute:sun-fill',
        onSelect: () => {
            colorMode.preference = 'light'
        },
    },
    {
        label: 'ダーク',
        icon: 'mingcute:moon-fill',
        onSelect: () => {
            colorMode.preference = 'dark'
        },
    },
]
</script>

<template>
    <ClientOnly>
        <UDropdownMenu
            :items="themeMenu"
            :content="{
                align: 'center',
                side: 'bottom',
                sideOffset: 8,
            }"
        >
            <UTooltip text="テーマ" :delay-duration="50">
                <UButton
                    :icon="colorMode.value === 'dark' ? 'mingcute:moon-fill' : 'mingcute:sun-fill'"
                    aria-label="テーマ"
                    variant="ghost"
                />
            </UTooltip>
        </UDropdownMenu>

        <template #fallback>
            <UButton icon="mingcute:palette-fill" aria-label="テーマ" variant="ghost" />
        </template>
    </ClientOnly>
</template>
