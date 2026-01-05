<script setup lang="ts">
const colorMode = useColorMode()

const themeMenu = [
    {
        label: 'システム',
        icon: 'lucide:monitor',
        onSelect: () => {
            colorMode.preference = 'system'
        },
    },
    {
        label: 'ライト',
        icon: 'lucide:sun',
        onSelect: () => {
            colorMode.preference = 'light'
        },
    },
    {
        label: 'ダーク',
        icon: 'lucide:moon',
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
                    :icon="colorMode.value === 'dark' ? 'lucide:moon' : 'lucide:sun'"
                    aria-label="テーマ"
                    variant="ghost"
                />
            </UTooltip>
        </UDropdownMenu>

        <template #fallback>
            <UButton icon="lucide:palette" aria-label="テーマ" variant="ghost" />
        </template>
    </ClientOnly>
</template>
