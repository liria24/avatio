<script setup lang="ts">
const user = useSupabaseUser()
const route = useRoute('setup-id')

const id = Number(route.params.id)
const bookmark = ref(false)

const modalLogin = ref(false)
const modalReport = ref(false)
const response = ref<SetupClient | null>(null)

if (!id)
    showError({
        statusCode: 404,
        message: 'IDが無効です',
    })

try {
    const data = await $fetch(`/api/setup/${id}`)

    response.value = data

    defineSeo({
        title: `${data.name} @${data.author.name}`,
        description: data.description || undefined,
        image: data.images.length
            ? getImage(data.images[0]!.name, { prefix: 'setup' })
            : 'https://avatio.me/ogp.png',
    })
} catch {
    showError({
        statusCode: 404,
        message: 'セットアップが見つかりませんでした',
    })
}

const onReportClick = () => {
    if (user.value) modalReport.value = true
    else modalLogin.value = true
}

const onLoginSuccess = async () => {
    modalLogin.value = false
    if (!response.value) return
    bookmark.value = await useCheckBookmark(id)
}

onMounted(async () => {
    bookmark.value = await useCheckBookmark(id)
})
</script>

<template>
    <div v-if="response" class="flex flex-col gap-5">
        <UiBreadcrumb
            :items="[
                { text: response.author.name, href: `/@${response.author.id}` },
                { text: response.name },
            ]"
        />

        <SetupsViewer
            :id="id"
            :created-at="response.created_at"
            :title="response.name"
            :description="response.description"
            :images="response.images"
            :tags="response.tags"
            :co-authors="response.co_authors"
            :unity="response.unity"
            :author="response.author"
            :items="response.items"
            @login="modalLogin = true"
        />

        <Button
            label="セットアップを報告"
            icon="lucide:flag"
            :icon-size="16"
            variant="flat"
            class="mt-6 w-fit px-3 py-2 text-xs font-semibold text-zinc-500 hover:bg-zinc-300 dark:text-zinc-400 hover:dark:bg-zinc-700"
            icon-class="text-red-400 dark:text-red-400"
            @click="onReportClick"
        />

        <Modal v-model="modalLogin">
            <UiLogin
                :redirect="`/setup/${route.params.id}`"
                @login-success="onLoginSuccess"
            />
        </Modal>

        <ModalReportSetup v-model="modalReport" :id="Number(id)" />
    </div>
</template>
