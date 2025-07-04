<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

interface Props {
    setup: Setup
}
const props = defineProps<Props>()

const session = await useGetSession()
const toast = useToast()

const hideReason = ref('')
const modalHide = ref(false)

const hideSetup = async () => {
    if (session.value?.user.role !== 'admin') {
        toast.add({
            title: '権限がありません',
            description: 'Admin アカウントでログインしてください。',
            color: 'error',
        })
        return
    }

    try {
        await $fetch(`/api/admin/setup/${props.setup.id}`, {
            method: 'PATCH',
            body: {
                hide: true,
                hideReason: hideReason.value.length
                    ? hideReason.value
                    : undefined,
            },
        })
        toast.add({
            title: 'セットアップが非表示になりました',
            color: 'success',
        })
        hideReason.value = ''
        modalHide.value = false
    } catch (error) {
        console.error('セットアップの非表示に失敗:', error)
        toast.add({
            title: 'セットアップの非表示に失敗しました',
            color: 'error',
        })
    }
}

const unhideSetup = async () => {
    if (session.value?.user.role !== 'admin') {
        toast.add({
            title: '権限がありません',
            description: 'Admin アカウントでログインしてください。',
            color: 'error',
        })
        return
    }

    try {
        await $fetch(`/api/admin/setup/${props.setup.id}`, {
            method: 'PATCH',
            body: { hide: false },
        })
        toast.add({
            title: 'セットアップが再表示されました',
            color: 'success',
        })
        modalHide.value = false
    } catch (error) {
        console.error('セットアップの再表示に失敗:', error)
        toast.add({
            title: 'セットアップの再表示に失敗しました',
            color: 'error',
        })
    }
}

const shareX = useSocialShare({
    network: 'x',
    title: `${props.setup.name} @${props.setup.user.name} | Avatio`,
    image: props.setup.images?.[0]?.url || undefined,
})
const shareBluesky = useSocialShare({
    network: 'bluesky',
    title: `${props.setup.name} @${props.setup.user.name} | Avatio`,
    image: props.setup.images?.[0]?.url || undefined,
})
const shareLine = useSocialShare({
    network: 'line',
    title: `${props.setup.name} @${props.setup.user.name} | Avatio`,
    image: props.setup.images?.[0]?.url || undefined,
})

const socialShareItems = ref<DropdownMenuItem[]>([
    [
        {
            label: 'リンクをコピー',
            icon: 'lucide:link',
            onSelect: () => {
                navigator.clipboard
                    .writeText(window.location.href)
                    .then(() => {
                        toast.add({ title: 'リンクがコピーされました' })
                    })
                    .catch(() => {
                        toast.add({
                            title: 'リンクのコピーに失敗しました',
                            color: 'error',
                        })
                    })
            },
        },
    ],
    [
        {
            label: 'X',
            icon: 'simple-icons:x',
            onSelect: () => {
                navigateTo(shareX.value.shareUrl, {
                    external: true,
                    open: { target: '_blank' },
                })
            },
        },
        {
            label: 'Bluesky',
            icon: 'simple-icons:bluesky',
            onSelect: () => {
                navigateTo(shareBluesky.value.shareUrl, {
                    external: true,
                    open: { target: '_blank' },
                })
            },
        },
        {
            label: 'LINE',
            icon: 'simple-icons:line',
            onSelect: () => {
                navigateTo(shareLine.value.shareUrl, {
                    external: true,
                    open: { target: '_blank' },
                })
            },
        },
    ],
])

const bookmark = ref(false)
const bookmarkButtonStyle = computed<{
    icon: string
    label: string
    color: 'secondary' | 'primary'
}>(() => ({
    icon: bookmark.value ? 'lucide:bookmark-check' : 'lucide:bookmark',
    label: bookmark.value ? 'ブックマークから削除' : 'ブックマーク',
    color: bookmark.value ? 'secondary' : 'primary',
}))

const applyBookmark = useDebounceFn(async (isBookmarked: boolean) => {
    try {
        if (isBookmarked)
            await $fetch(`/api/setups/bookmark/${props.setup.id}`, {
                method: 'POST',
            })
        else
            await $fetch(`/api/setups/bookmark/${props.setup.id}`, {
                method: 'DELETE',
            })

        toast.add({
            title: isBookmarked
                ? 'ブックマークしました'
                : 'ブックマークを解除しました',
            color: isBookmarked ? 'success' : 'info',
        })
    } catch (error) {
        console.error('ブックマークの適用に失敗:', error)
        toast.add({
            title: 'ブックマークの適用に失敗しました',
            color: 'error',
        })
        return
    }
}, 500)

const toggleBookmark = () => {
    bookmark.value = !bookmark.value
    applyBookmark(bookmark.value)
}

const deleteSetup = async () => {
    try {
        await $fetch(`/api/setups/${props.setup.id}`, {
            method: 'DELETE',
        })
        toast.add({
            title: 'セットアップが削除されました',
            description: 'セットアップが正常に削除されました。',
            color: 'success',
        })
        navigateTo('/?cache=false')
    } catch (error) {
        toast.add({
            title: 'セットアップの削除に失敗しました',
            description:
                error instanceof Error
                    ? error.message
                    : '不明なエラーが発生しました',
            color: 'error',
        })
    }
}

onMounted(async () => {
    if (session.value) {
        try {
            const response = await $fetch<PaginationResponse<Bookmark[]>>(
                '/api/setups/bookmark',
                {
                    query: { setupId: props.setup.id, limit: 1 },
                }
            )
            if (response.data?.length) bookmark.value = true
            else bookmark.value = false
        } catch (error) {
            console.error('ブックマークの取得に失敗:', error)
        }
    }
})
</script>

<template>
    <div class="flex items-center gap-0.5">
        <template v-if="session?.user.role === 'admin'">
            <UModal
                v-if="props.setup.hidAt"
                v-model:open="modalHide"
                title="セットアップを再表示"
            >
                <UButton
                    icon="lucide:eye"
                    variant="ghost"
                    size="sm"
                    class="p-2"
                />

                <template #body>
                    <UAlert
                        icon="lucide:eye"
                        title="これは Admin アクションです"
                        description="セットアップは再表示され、ユーザーに見えるようになります。"
                        color="info"
                        variant="subtle"
                    />
                </template>
                <template #footer>
                    <UButton
                        label="再表示する"
                        color="neutral"
                        size="lg"
                        block
                        @click="unhideSetup"
                    />
                </template>
            </UModal>
            <UModal
                v-else
                v-model:open="modalHide"
                title="セットアップを非表示"
            >
                <UButton
                    icon="lucide:eye-off"
                    variant="ghost"
                    size="sm"
                    class="p-2"
                />

                <template #body>
                    <div class="flex flex-col gap-2">
                        <UAlert
                            icon="lucide:eye-off"
                            title="これは Admin アクションです"
                            description="セットアップは非表示になり、再度表示するまでユーザーには見えなくなります。"
                            color="warning"
                            variant="subtle"
                        />
                        <UFormField label="理由" required>
                            <UTextarea
                                v-model="hideReason"
                                autoresize
                                class="w-full"
                            />
                        </UFormField>
                    </div>
                </template>

                <template #footer>
                    <UButton
                        :disabled="!hideReason.length"
                        label="非表示にする"
                        color="neutral"
                        size="lg"
                        block
                        @click="hideSetup"
                    />
                </template>
            </UModal>
        </template>

        <UButton
            v-if="session"
            :icon="bookmarkButtonStyle.icon"
            :aria-label="bookmarkButtonStyle.label"
            :color="bookmarkButtonStyle.color"
            variant="ghost"
            size="sm"
            class="p-2"
            @click="toggleBookmark"
        />
        <ModalLogin v-else>
            <UButton
                :icon="bookmarkButtonStyle.icon"
                :aria-label="bookmarkButtonStyle.label"
                :color="bookmarkButtonStyle.color"
                variant="ghost"
                size="sm"
                class="p-2"
            />
        </ModalLogin>

        <template v-if="session?.user.id === props.setup.user.id">
            <UButton
                :to="`/setup/compose?edit=${props.setup.id}`"
                aria-label="編集"
                icon="lucide:pen"
                variant="ghost"
                size="sm"
                class="p-2"
            />

            <UModal title="セットアップを削除">
                <UButton
                    aria-label="削除"
                    icon="lucide:trash"
                    variant="ghost"
                    size="sm"
                    class="p-2"
                />

                <template #body>
                    <UAlert
                        icon="lucide:trash"
                        title="本当に削除しますか？"
                        description="この操作は取り消すことができません。"
                        color="warning"
                        variant="subtle"
                    />
                </template>

                <template #footer>
                    <UButton
                        label="削除"
                        color="error"
                        size="lg"
                        block
                        @click="deleteSetup"
                    />
                </template>
            </UModal>
        </template>

        <template v-else>
            <ModalReportSetup v-if="session" :setup-id="props.setup.id">
                <UButton
                    icon="lucide:flag"
                    aria-label="報告"
                    variant="ghost"
                    size="sm"
                    class="p-2"
                />
            </ModalReportSetup>
            <ModalLogin v-else>
                <UButton
                    icon="lucide:flag"
                    aria-label="報告"
                    variant="ghost"
                    size="sm"
                    class="p-2"
                />
            </ModalLogin>
        </template>

        <UDropdownMenu
            :items="socialShareItems"
            :content="{
                align: 'center',
                side: 'bottom',
                sideOffset: 8,
            }"
            :ui="{
                content: 'w-40',
            }"
        >
            <UButton
                icon="lucide:share-2"
                aria-label="シェア"
                variant="ghost"
                size="sm"
                class="p-2"
            />
        </UDropdownMenu>
    </div>
</template>
