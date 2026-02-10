<script setup lang="ts">
const { locales, setLocale } = useI18n()
</script>

<template>
    <ClientOnly>
        <UDropdownMenu
            :items="
                locales.map((locale) => ({
                    label: locale.name,
                    icon: locale.icon,
                    onSelect: () => setLocale(locale.code),
                }))
            "
            :content="{
                align: 'center',
                side: 'bottom',
                sideOffset: 8,
            }"
        >
            <UTooltip :text="$t('language')" :delay-duration="50">
                <UButton
                    icon="mingcute:translate-2-line"
                    :aria-label="$t('language')"
                    variant="ghost"
                />
            </UTooltip>
        </UDropdownMenu>

        <template #fallback>
            <UButton
                icon="mingcute:translate-2-line"
                :aria-label="$t('language')"
                variant="ghost"
            />
        </template>
    </ClientOnly>
</template>
