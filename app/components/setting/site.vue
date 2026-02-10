<script lang="ts" setup>
interface Props {
    sectionId: string
}
const { sectionId } = defineProps<Props>()
</script>

<template>
    <section :id="sectionId" class="flex flex-col gap-4">
        <h2 class="text-muted text-sm leading-none font-semibold text-nowrap">
            {{ $t('settings.site.title') }}
        </h2>

        <UCard>
            <div class="flex w-full flex-col gap-6">
                <UPageCard
                    :title="$t('settings.site.language')"
                    :description="$t('settings.site.languageDescription')"
                    orientation="horizontal"
                    variant="naked"
                >
                    <USelect variant="subtle" color="neutral" class="ml-auto w-fit min-w-48" />
                </UPageCard>

                <UPageCard
                    :title="$t('settings.site.theme')"
                    :description="$t('settings.site.themeDescription')"
                    orientation="horizontal"
                    variant="naked"
                >
                    <USelect variant="subtle" color="neutral" class="ml-auto w-fit min-w-48" />
                </UPageCard>
            </div>
        </UCard>
    </section>
</template>
