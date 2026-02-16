<script setup lang="ts">
import type { EditorContentType, EditorProps } from '@nuxt/ui'
import { defu } from 'defu'

const editorRef = useTemplateRef('editorRef')

const input = defineModel<string>({ default: '' })

interface Props extends Pick<EditorProps, 'ui'> {
    contentType?: EditorContentType
    placeholder?: string
    editable?: boolean
    autofocus?: boolean
}
const {
    contentType = 'markdown',
    placeholder = 'Type / for commands...',
    editable = true,
    autofocus = false,
    ui,
} = defineProps<Props>()
</script>

<template>
    <UEditor
        ref="editorRef"
        v-slot="{ editor }"
        v-model="input"
        :content-type="contentType"
        :placeholder
        :editable
        :autofocus
        :spellcheck="false"
        :ui="
            defu(ui, {
                root: 'flex grow flex-col gap-2',
                content: 'flex grow',
                base: 'px-2 sm:px-2 *:my-2.5 [&_p]:leading-6',
            })
        "
    >
        <slot name="top" :editor />

        <slot :editor />

        <TextEditorBubbleToolbar :editor />
        <TextEditorSuggestionMenu :editor />

        <UEditorDragHandle :editor class="z-50" />
    </UEditor>
</template>
