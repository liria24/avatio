<script setup lang="ts">
import type { EditorToolbarItem } from '@nuxt/ui'
import type { Editor } from '@tiptap/vue-3'
// import { useEditorCompletion } from './useComplesion'

interface Props {
    editor: Editor
}
const props = defineProps<Props>()

// const editorRef = useTemplateRef('editorRef')

// const { isLoading: aiLoading } = useEditorCompletion(editorRef)

const fixedToolbarItems = computed<EditorToolbarItem[][]>(() => [
    // [
    //     {
    //         icon: 'i-lucide-sparkles',
    //         label: 'Improve',
    //         variant: 'soft',
    //         // loading: aiLoading.value,
    //         content: {
    //             align: 'start',
    //         },
    //         items: [
    //             {
    //                 kind: 'aiFix',
    //                 icon: 'i-lucide-spell-check',
    //                 label: 'Fix spelling & grammar',
    //             },
    //             {
    //                 kind: 'aiExtend',
    //                 icon: 'i-lucide-unfold-vertical',
    //                 label: 'Extend text',
    //             },
    //             {
    //                 kind: 'aiReduce',
    //                 icon: 'i-lucide-fold-vertical',
    //                 label: 'Reduce text',
    //             },
    //             {
    //                 kind: 'aiSimplify',
    //                 icon: 'i-lucide-lightbulb',
    //                 label: 'Simplify text',
    //             },
    //             {
    //                 kind: 'aiContinue',
    //                 icon: 'i-lucide-text',
    //                 label: 'Continue sentence',
    //             },
    //             {
    //                 kind: 'aiSummarize',
    //                 icon: 'i-lucide-list',
    //                 label: 'Summarize',
    //             },
    //             {
    //                 icon: 'i-lucide-languages',
    //                 label: 'Translate',
    //                 children: [
    //                     {
    //                         kind: 'aiTranslate',
    //                         language: 'English',
    //                         label: 'English',
    //                     },
    //                     {
    //                         kind: 'aiTranslate',
    //                         language: 'Japanese',
    //                         label: 'Japanese',
    //                     },
    //                     {
    //                         kind: 'aiTranslate',
    //                         language: 'Korean',
    //                         label: 'Korean',
    //                     },
    //                 ],
    //             },
    //         ],
    //     },
    // ],
    [
        {
            kind: 'undo',
            icon: 'lucide:undo',
            tooltip: { text: 'Undo' },
        },
        {
            kind: 'redo',
            icon: 'lucide:redo',
            tooltip: { text: 'Redo' },
        },
    ],
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
        {
            icon: 'lucide:list',
            tooltip: { text: 'Lists' },
            content: {
                align: 'start',
            },
            items: [
                {
                    kind: 'bulletList',
                    icon: 'lucide:list',
                    label: 'Bullet List',
                },
                {
                    kind: 'orderedList',
                    icon: 'lucide:list-ordered',
                    label: 'Numbered List',
                },
            ],
        },
        {
            kind: 'blockquote',
            icon: 'lucide:text-quote',
            tooltip: { text: 'Blockquote' },
        },
        {
            kind: 'codeBlock',
            icon: 'lucide:square-code',
            tooltip: { text: 'Code Block' },
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
    [
        {
            slot: 'link' as const,
            icon: 'lucide:link',
        },
    ],
])
</script>

<template>
    <UEditorToolbar
        :editor="props.editor"
        :items="fixedToolbarItems"
        class="bg-muted sticky inset-x-0 top-0 z-50 overflow-x-auto rounded-lg p-2"
    >
        <template #link>
            <TextEditorLinkPopover :editor="props.editor" />
        </template>
    </UEditorToolbar>
</template>
