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
    title: encodeURIComponent(props.title),
    image: props.image || undefined,
})
const shareBluesky = useSocialShare({
    network: 'bluesky',
    title: encodeURIComponent(props.title),
    image: props.image || undefined,
})
const shareLine = useSocialShare({
    network: 'line',
    title: encodeURIComponent(props.title),
    image: props.image || undefined,
})

const socialShareItems = ref<DropdownMenuItem[]>([
    [
        {
            label: copied.value ? 'コピーしました' : 'リンクをコピー',
            icon: copied.value ? 'lucide:check' : 'lucide:link',
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
            icon: 'simple-icons:x',
            onSelect: () => {
                navigateTo(shareX.value?.shareUrl, {
                    external: true,
                    open: { target: '_blank' },
                })
            },
        },
        {
            label: 'Bluesky',
            icon: 'simple-icons:bluesky',
            onSelect: () => {
                navigateTo(shareBluesky.value?.shareUrl, {
                    external: true,
                    open: { target: '_blank' },
                })
            },
        },
        {
            label: 'LINE',
            icon: 'simple-icons:line',
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
        icon="lucide:share-2"
        aria-label="シェア"
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
            icon="lucide:share-2"
            aria-label="シェア"
            variant="ghost"
            size="sm"
            class="p-2"
        />
    </UDropdownMenu>
</template>
