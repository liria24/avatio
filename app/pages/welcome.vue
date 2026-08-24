<script lang="ts" setup>
definePageMeta({
    auth: 'user',
    layout: 'minimal',
})

const { user, updateUser } = useUserSession()
const localePath = useLocalePath()
const { t } = useI18n()

const input = ref<string>(user.value?.username || '')
const available = ref<boolean>(false)

const updateId = async (username: string) => {
    await updateUser({ username })
    await navigateTo(localePath('/'), { external: true })
}

useSeo({
    title: t('welcome.title'),
    image: '/ogp_2.png',
    twitterCard: 'summary_large_image',
})
</script>

<template>
    <div class="mx-auto flex h-full max-w-sm flex-col items-center justify-center gap-6 pb-28">
        <h1 class="mb-4 text-4xl font-bold text-nowrap">{{ $t('welcome.title') }}</h1>

        <InputUsername
            v-model="input"
            v-model:available="available"
            variant="soft"
            size="lg"
            class="w-full"
        />

        <UButton
            :label="$t('welcome.changeUsername')"
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
