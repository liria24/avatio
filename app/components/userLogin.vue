<script lang="ts" setup>
import { z } from 'zod'

const { signIn } = useAuth()
const route = useRoute()

const emailLoginSchema = z.object({
    email: z.email('Invalid email'),
    password: z.string('Password is required').min(8, 'Must be at least 8 characters'),
})
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

        <DevOnly>
            <div class="relative">
                <UAuthForm
                    :schema="emailLoginSchema"
                    :fields="[
                        {
                            name: 'email',
                            type: 'email',
                            icon: 'mingcute:mail-fill',
                            placeholder: 'user@example.com',
                            required: true,
                        },
                        {
                            name: 'password',
                            type: 'password',
                            icon: 'mingcute:key-2-fill',
                            placeholder: 'password',
                            required: true,
                        },
                    ]"
                    :submit="{
                        label: 'Login with Email and Password',
                        color: 'neutral',
                        variant: 'subtle',
                    }"
                    class="ring-muted mb-4 rounded-xl p-4 ring-1"
                    @submit="signIn.email($event.data.email, $event.data.password)"
                />

                <UBadge
                    label="// Dev Only"
                    variant="subtle"
                    color="neutral"
                    class="absolute -top-4 left-4"
                />
            </div>
        </DevOnly>

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
