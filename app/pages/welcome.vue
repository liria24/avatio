<script lang="ts" setup>
definePageMeta({
    middleware: 'session',
    layout: 'minimal',
})

const { getSession } = useAuth()
const session = await getSession()
const { updateUsername } = useUserSettings()

const input = ref<string>(session.value?.user.username || '')
const available = ref<boolean>(false)

const updateId = async (username: string) => {
    const success = await updateUsername(session.value!.user.username!, username)
    if (success) {
        await navigateTo('/', { external: true })
    }
}

defineSeo({
    title: 'Avatioにようこそ',
})
</script>

<template>
    <div class="mx-auto flex h-full max-w-sm flex-col items-center justify-center gap-6 pb-28">
        <h1 class="mb-4 text-4xl font-bold text-nowrap">Avatio にようこそ</h1>

        <InputUsername
            v-model="input"
            v-model:available="available"
            :ui="{ input: { variant: 'soft', size: 'lg' } }"
            class="w-full"
        />

        <UButton
            label="ユーザーIDを変更"
            color="neutral"
            variant="solid"
            size="lg"
            :disabled="!available"
            loading-auto
            class="rounded-xl px-4"
            @click="updateId(input)"
        />
    </div>
</template>
