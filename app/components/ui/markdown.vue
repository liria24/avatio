<script lang="ts" setup>
import { marked } from 'marked'
import { twMerge } from 'tailwind-merge'

interface Props {
    content: string
    class?: string | string[]
}
const props = defineProps<Props>()

const main = await marked.parse(props.content, { breaks: true })
</script>

<template>
    <!-- eslint-disable vue/no-v-html -->
    <div
        v-html="lineBreak(main)"
        :class="
            twMerge(
                'max-w-none',
                'prose prose-zinc dark:prose-invert',
                'prose-p:break-keep prose-p:[overflow-wrap:anywhere;]',
                'prose-li:break-keep prose-li:[overflow-wrap:anywhere;]',
                'prose-blockquote:[&_p]:not-italic prose-blockquote:[&_p]:before:content-[none] prose-blockquote:[&_p]:after:content-[none] prose-blockquote:text-zinc-500 prose-blockquote:dark:text-zinc-400',
                'prose-img:rounded-md prose-img:first:mt-0 prose-img:last:mb-0',
                props.class
            )
        "
    ></div>
</template>
