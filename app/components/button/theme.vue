<script lang="ts" setup>
const colorMode = useColorMode()
</script>

<template>
    <ClientOnly>
        <UTooltip text="テーマ" :delay-duration="0">
            <UButton
                :icon="
                    colorMode.value === 'dark' ? 'lucide:moon' : 'lucide:sun'
                "
                aria-label="テーマ"
                variant="ghost"
                @click="
                    colorMode.preference =
                        colorMode.value === 'dark' ? 'light' : 'dark'
                "
            />
        </UTooltip>
        <template #fallback>
            <UTooltip text="テーマ" :delay-duration="0">
                <UButton
                    icon="lucide:palette"
                    aria-label="テーマ"
                    variant="ghost"
                    @click="
                        colorMode.preference =
                            colorMode.value === 'dark' ? 'light' : 'dark'
                    "
                />
            </UTooltip>
        </template>
    </ClientOnly>
</template>
