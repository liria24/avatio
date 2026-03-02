<script lang="ts" setup>
const { signIn } = useAuth()
const route = useRoute()
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
            @click="signIn.twitter({ callbackURL: route.path })"
        />

        <p class="text-muted text-right text-xs">
            {{ $t('modal.login.agreement') }}
            <br class="sm:hidden" />
            <ULink :to="$localePath('/terms')" target="_blank" class="ml-2 font-bold">
                {{ $t('modal.login.footer.terms') }}
            </ULink>
            <ULink :to="$localePath('/privacy-policy')" target="_blank" class="ml-2 font-bold">
                {{ $t('modal.login.footer.privacy') }}
            </ULink>
        </p>
        <p class="text-muted text-right text-xs">{{ $t('modal.login.firstTimeNotice') }}</p>
    </div>
</template>
