<script lang="ts" setup>
const { app } = useAppConfig()
const { dismissed, dismissBanner } = useOwnerWarningBanner()
</script>

<template>
    <div
        v-if="!dismissed"
        class="ring-muted flex items-center justify-between gap-3 rounded-lg px-3 py-2 ring-1"
    >
        <ULink :to="`mailto:${app.mailaddress}?subject=${$t('banner.ownerWarningSubject')}`">
            <p class="text-toned w-fit text-xs wrap-anywhere break-keep">
                {{ $t('banner.ownerWarning') }}
            </p>
        </ULink>

        <UButton
            :aria-label="$t('close')"
            icon="mingcute:close-line"
            variant="ghost"
            size="sm"
            class="place-self-end"
            @click="dismissBanner"
        />
    </div>
</template>
