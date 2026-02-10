<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

interface Props {
    title: string
    description?: string | null
    image?: string | null
}
const props = defineProps<Props>()

const toast = useToast()
const location = useBrowserLocation()
const { copy, copied } = useClipboard({ source: location.value.href })
const { isMobile } = useDevice()
const { share, isSupported: shareSupported } = useShare()

const shareX = useSocialShare({
    network: 'x',
    title: props.title,
    image: props.image || undefined,
})
const shareBluesky = useSocialShare({
    network: 'bluesky',
    title: props.title,
    image: props.image || undefined,
})
const shareLine = useSocialShare({
    network: 'line',
    title: props.title,
    image: props.image || undefined,
})

const socialShareItems = ref<DropdownMenuItem[]>([
    [
        {
            label: copied.value ? 'コピーしました' : 'リンクをコピー',
            icon: copied.value ? 'mingcute:check-fill' : 'mingcute:link-fill',
            onSelect: () => {
                copy(location.value.href)
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
            icon: 'mingcute:social-x-fill',
            onSelect: () => {
                navigateTo(shareX.value?.shareUrl, {
                    external: true,
                    open: { target: '_blank' },
                })
            },
        },
        {
            label: 'Bluesky',
            icon: 'mingcute:bluesky-social-fill',
            onSelect: () => {
                navigateTo(shareBluesky.value?.shareUrl, {
                    external: true,
                    open: { target: '_blank' },
                })
            },
        },
        {
            label: 'LINE',
            icon: 'mingcute:line-app-fill',
            onSelect: () => {
                navigateTo(shareLine.value?.shareUrl, {
                    external: true,
                    open: { target: '_blank' },
                })
            },
        },
    ],
])
</script>

<template>
    <UButton
        v-if="isMobile && shareSupported"
        icon="mingcute:share-2-fill"
        :aria-label="$t('share')"
        variant="ghost"
        size="sm"
        class="p-2"
        @click="
            share({
                title: props.title,
                text: props.description || undefined,
                url: location.href,
            })
        "
    />

    <UDropdownMenu
        v-else
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
            icon="mingcute:share-2-fill"
            :aria-label="$t('share')"
            variant="ghost"
            size="sm"
            class="p-2"
        />
    </UDropdownMenu>
</template>
