<script lang="ts" setup>
const { signIn } = useAuth()
</script>

<template>
    <div class="flex flex-col gap-2">
        <h1 class="mb-2 text-center text-2xl leading-none font-bold text-nowrap">
            {{ $t('modal.login.title') }}
        </h1>

        <p class="text-muted text-center text-sm">{{ $t('modal.login.description') }}</p>

        <UButton
            loading-auto
            :label="$t('modal.login.loginWith', { provider: 'X (Twitter)' })"
            icon="mingcute:social-x-fill"
            block
            size="lg"
            variant="outline"
            color="neutral"
            class="mt-5 mb-6 rounded-xl py-4"
            @click="signIn.twitter()"
        />

        <div class="flex w-full items-center justify-end gap-3">
            <p class="text-muted text-right text-xs">{{ $t('modal.login.agreement') }}</p>
            <UButton
                :to="$localePath('/terms')"
                target="_blank"
                :label="$t('modal.login.footer.terms')"
                variant="link"
                size="sm"
                color="neutral"
                class="p-0"
            />
            <UButton
                :to="$localePath('/privacy-policy')"
                target="_blank"
                :label="$t('modal.login.footer.privacy')"
                variant="link"
                size="sm"
                color="neutral"
                class="p-0"
            />
        </div>

        <p class="text-muted text-right text-xs">{{ $t('modal.login.firstTimeNotice') }}</p>
    </div>
</template>
