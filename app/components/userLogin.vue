<script lang="ts" setup>
import { z } from 'zod'

interface Props {
    callbackURL?: string
}
const { callbackURL } = defineProps<Props>()

const signInEmail = useSignIn('email')
const signInSocial = useSignIn('social')
const signUpEmail = useSignUp('email')
const route = useRoute()
const register = ref(false)
const { public: publicConfig } = useRuntimeConfig()

const emailLoginSchema = z.object({
    email: z.email('Invalid email'),
    password: z.string('Password is required').min(8, 'Must be at least 8 characters'),
})

const emailRegistrationSchema = emailLoginSchema.extend({
    name: z.string().trim().min(1, 'Name is required'),
    username: usernameSchema,
})

const registerWithEmail = async (data: {
    email: string
    name: string
    password: string
    username: string
}) => {
    await signUpEmail.execute(data)
    if (signUpEmail.status.value === 'success') window.location.assign(callbackURL || route.path)
}
</script>

<template>
    <div class="flex flex-col gap-2">
        <h1 class="mb-2 text-center text-2xl leading-none font-bold text-nowrap">
            {{ $t('modal.login.title') }}
        </h1>

        <p class="text-muted text-center text-sm">{{ $t('modal.login.description') }}</p>

        <UButton
            v-if="publicConfig.twitterAuthEnabled"
            loading-auto
            :label="$t('modal.login.loginWith', { provider: 'X (Twitter)' })"
            icon="mingcute:social-x-fill"
            block
            size="lg"
            variant="outline"
            color="neutral"
            class="mt-5 mb-6 rounded-xl py-4"
            @click="
                signInSocial.execute({
                    provider: 'twitter',
                    callbackURL: callbackURL || route.path,
                })
            "
        />

        <DevOnly>
            <div class="relative">
                <UAuthForm
                    :schema="register ? emailRegistrationSchema : emailLoginSchema"
                    :fields="[
                        ...(register
                            ? [
                                  {
                                      name: 'name',
                                      type: 'text' as const,
                                      icon: 'mingcute:user-3-fill',
                                      placeholder: $t('modal.login.local.name'),
                                      required: true,
                                  },
                                  {
                                      name: 'username',
                                      type: 'text' as const,
                                      icon: 'mingcute:at-line',
                                      placeholder: $t('input.username.placeholder'),
                                      required: true,
                                  },
                              ]
                            : []),
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
                        label: register
                            ? $t('modal.login.local.register')
                            : $t('modal.login.local.login'),
                        color: 'neutral',
                        variant: 'subtle',
                    }"
                    class="ring-muted mb-4 rounded-xl p-4 ring-1"
                    @submit="
                        register
                            ? registerWithEmail($event.data)
                            : signInEmail.execute({
                                  email: $event.data.email,
                                  password: $event.data.password,
                                  callbackURL: callbackURL || route.path,
                              })
                    "
                />

                <UButton
                    :label="
                        register
                            ? $t('modal.login.local.switchToLogin')
                            : $t('modal.login.local.switchToRegister')
                    "
                    variant="link"
                    color="neutral"
                    block
                    @click="register = !register"
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
