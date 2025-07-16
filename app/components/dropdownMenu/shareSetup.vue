<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

interface Props {
    setup: Setup
}
const props = defineProps<Props>()

const toast = useToast()

const shareX = useSocialShare({
    network: 'x',
    title: encodeURIComponent(`${props.setup.name} | Avatio`),
    image: props.setup.images?.[0]?.url || undefined,
})
const shareBluesky = useSocialShare({
    network: 'bluesky',
    title: encodeURIComponent(`${props.setup.name} | Avatio`),
    image: props.setup.images?.[0]?.url || undefined,
})
const shareLine = useSocialShare({
    network: 'line',
    title: encodeURIComponent(`${props.setup.name} | Avatio`),
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
</script>

<template>
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
        <slot />
    </UDropdownMenu>
</template>
