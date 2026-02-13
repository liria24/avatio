<script setup lang="ts">
import type { EditorSuggestionMenuItem } from '@nuxt/ui'
import type { Editor } from '@tiptap/vue-3'

interface Props {
    editor: Editor
}
const props = defineProps<Props>()

const suggestionItems = computed<EditorSuggestionMenuItem[][]>(() => [
    [
        {
            type: 'label',
            label: 'Text',
        },
        {
            kind: 'paragraph',
            label: 'Paragraph',
            icon: 'lucide:type',
        },
        {
            kind: 'heading',
            level: 1,
            label: 'Heading 1',
            icon: 'lucide:heading-1',
        },
        {
            kind: 'heading',
            level: 2,
            label: 'Heading 2',
            icon: 'lucide:heading-2',
        },
        {
            kind: 'heading',
            level: 3,
            label: 'Heading 3',
            icon: 'lucide:heading-3',
        },
    ],
    [
        {
            type: 'label',
            label: 'Lists',
        },
        {
            kind: 'bulletList',
            label: 'Bullet List',
            icon: 'lucide:list',
        },
        {
            kind: 'orderedList',
            label: 'Numbered List',
            icon: 'lucide:list-ordered',
        },
    ],
    [
        {
            type: 'label',
            label: 'Insert',
        },
        {
            kind: 'blockquote',
            label: 'Blockquote',
            icon: 'lucide:text-quote',
        },
        {
            kind: 'codeBlock',
            label: 'Code Block',
            icon: 'lucide:square-code',
        },
        {
            kind: 'horizontalRule',
            label: 'Divider',
            icon: 'lucide:separator-horizontal',
        },
    ],
])

// eslint-disable-next-line no-constant-condition
const appendToBody = false ? () => document.body : undefined
</script>

<template>
    <UEditorSuggestionMenu
        :editor="props.editor"
        :items="suggestionItems"
        :append-to="appendToBody"
    />
</template>
