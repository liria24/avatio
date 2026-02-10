<script lang="ts" setup>
definePageMeta({
    middleware: 'session',
})

const setupsPerPage: number = 50
const page = ref(1)

const { bookmarks, status, refresh } = await useBookmarks({
    query: computed(() => ({
        page: page.value,
        perPage: setupsPerPage,
    })),
})
const { t } = useI18n()

const setups = ref<SerializedSetup[]>([])

const loadMoreSetups = () => {
    if (bookmarks.value?.pagination.hasNext) {
        page.value += 1
        refresh()
    }
}

watchEffect(() => {
    if (bookmarks.value)
        setups.value.push(...bookmarks.value.data.map((bookmark) => bookmark.setup))
})

defineSeo({
    title: t('bookmarks.title'),
    description: t('bookmarks.description'),
})
</script>

<template>
    <div class="flex flex-col gap-5">
        <div class="flex items-center gap-2">
            <Icon name="mingcute:bookmark-fill" size="22" class="text-muted" />
            <h1 class="text-xl leading-none font-semibold text-nowrap">
                {{ $t('bookmarks.title') }}
            </h1>
        </div>

        <div class="flex w-full flex-col gap-3 self-center">
            <SetupsList v-model:setups="setups" v-model:status="status" />
            <UButton
                v-if="bookmarks?.pagination.hasNext"
                :loading="status === 'pending'"
                :label="$t('more')"
                @click="loadMoreSetups()"
            />
        </div>
    </div>
</template>
