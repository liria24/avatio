<script setup lang="ts">
const token = ref()

const isDev = import.meta.dev
const emailLoginState = reactive({ email: '', password: '' })
const handleLogin = async () => {
    try {
        await useLogin(
            emailLoginState.email,
            emailLoginState.password,
            token.value
        )
        navigateTo('/')
    } catch (error) {
        console.error(error)
    }
}
</script>

<template>
    <UCard>
        <template #header>
            <h1 class="text-2xl font-bold">ログイン</h1>
        </template>

        <div class="flex min-w-80 flex-col items-center gap-4">
            <UButton
                :loading="!token"
                label="X (Twitter) アカウントでログイン"
                icon="simple-icons:x"
                block
                color="neutral"
                class="py-3"
                @click="useLoginWithTwitter"
            />

            <UForm
                v-if="isDev"
                :state="emailLoginState"
                class="flex w-full flex-col gap-2"
                @submit="handleLogin"
            >
                <UFormField name="email" class="w-full">
                    <UInput
                        v-model="emailLoginState.email"
                        icon="lucide:mail"
                        placeholder="example@example.com"
                        class="w-full"
                    />
                </UFormField>
                <UFormField name="password" class="w-full">
                    <UInput
                        v-model="emailLoginState.password"
                        type="password"
                        icon="lucide:lock"
                        placeholder="password"
                        class="w-full"
                    />
                </UFormField>
                <UButton
                    label="Email login (Dev only)"
                    icon="lucide:mail"
                    :loading="!token"
                    variant="outline"
                    block
                    type="submit"
                />
            </UForm>

            <NuxtTurnstile v-model="token" />
        </div>

        <template #footer>
            <div class="flex flex-col items-center gap-4">
                <div class="flex items-center gap-3 self-center">
                    <UButton
                        to="/terms"
                        variant="link"
                        label="利用規約"
                        size="sm"
                        class="p-0"
                    />
                    <UButton
                        to="/privacy-policy"
                        variant="link"
                        label="プライバシーポリシー"
                        size="sm"
                        class="p-0"
                    />
                </div>
                <PopupTwitterWarning />
            </div>
        </template>
    </UCard>
</template>
