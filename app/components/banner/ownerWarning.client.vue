<script lang="ts" setup>
const { app } = useAppConfig()
const { dismissed, dismissBanner } = useOwnerWarningBanner()
</script>

<template>
    <div v-if="!dismissed" class="ring-muted flex items-start gap-3 rounded-lg px-3 py-2 ring-1">
        <ULink
            :to="`mailto:${app.mailaddress}?subject=${$t('banner.ownerWarningSubject')}`"
            class="my-auto flex items-start gap-2"
        >
            <Icon name="mingcute:mail-fill" size="18" />
            <p class="text-toned sentence w-fit text-xs">
                {{ $t('banner.ownerWarning') }}
            </p>
        </ULink>

        <UButton
            :aria-label="$t('close')"
            icon="mingcute:close-line"
            variant="ghost"
            size="sm"
            class="ml-auto"
            @click="dismissBanner"
        />
    </div>
</template>
