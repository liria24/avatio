<script setup lang="ts">
import type { EditorToolbarItem } from '@nuxt/ui'
import type { Editor } from '@tiptap/vue-3'

interface Props {
    editor: Editor
}
const props = defineProps<Props>()

const bubbleToolbarItems = computed<EditorToolbarItem[][]>(() => [
    [
        {
            icon: 'lucide:heading',
            tooltip: { text: 'Headings' },
            content: {
                align: 'start',
            },
            items: [
                {
                    kind: 'heading',
                    level: 1,
                    icon: 'lucide:heading-1',
                    label: 'Heading 1',
                },
                {
                    kind: 'heading',
                    level: 2,
                    icon: 'lucide:heading-2',
                    label: 'Heading 2',
                },
                {
                    kind: 'heading',
                    level: 3,
                    icon: 'lucide:heading-3',
                    label: 'Heading 3',
                },
                {
                    kind: 'heading',
                    level: 4,
                    icon: 'lucide:heading-4',
                    label: 'Heading 4',
                },
            ],
        },
    ],
    [
        {
            kind: 'mark',
            mark: 'bold',
            icon: 'lucide:bold',
            tooltip: { text: 'Bold' },
        },
        {
            kind: 'mark',
            mark: 'italic',
            icon: 'lucide:italic',
            tooltip: { text: 'Italic' },
        },
        {
            kind: 'mark',
            mark: 'underline',
            icon: 'lucide:underline',
            tooltip: { text: 'Underline' },
        },
        {
            kind: 'mark',
            mark: 'strike',
            icon: 'lucide:strikethrough',
            tooltip: { text: 'Strikethrough' },
        },
        {
            kind: 'mark',
            mark: 'code',
            icon: 'lucide:code',
            tooltip: { text: 'Code' },
        },
    ],
])
</script>

<template>
    <UEditorToolbar :editor="props.editor" :items="bubbleToolbarItems" layout="bubble" />
</template>
