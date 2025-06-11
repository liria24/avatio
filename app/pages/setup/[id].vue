<script setup lang="ts">
const user = useSupabaseUser()
const route = useRoute('setup-id')

const id = Number(route.params.id)
const bookmark = ref(false)

const modalLogin = ref(false)
const modalReport = ref(false)

const { setup } = useFetchSetup(id)

if (!id)
    showError({
        statusCode: 404,
        message: 'IDが無効です',
    })

const onReportClick = () => {
    if (user.value) modalReport.value = true
    else modalLogin.value = true
}

const onLoginSuccess = async () => {
    modalLogin.value = false
    if (!setup.value) return
    bookmark.value = await useCheckBookmark(id)
}

onMounted(async () => {
    bookmark.value = await useCheckBookmark(id)
})

if (setup.value)
    defineSeo({
        title: `${setup.value.name} @${setup.value.author.name}`,
        description: setup.value.description || undefined,
        image: setup.value.images.length
            ? getImage(setup.value.images[0]!.name, { prefix: 'setup' })
            : 'https://avatio.me/ogp.png',
    })
</script>

<template>
    <div v-if="setup" class="flex flex-col gap-5">
        <UiBreadcrumb
            :items="[
                { text: setup.author.name, href: `/@${setup.author.id}` },
                { text: setup.name },
            ]"
        />

        <SetupsViewer
            :id="id"
            :created-at="setup.created_at"
            :title="setup.name"
            :description="setup.description"
            :images="setup.images"
            :tags="setup.tags"
            :co-authors="setup.co_authors"
            :unity="setup.unity"
            :author="setup.author"
            :items="setup.items"
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
