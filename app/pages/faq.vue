<script lang="ts" setup>
import FaqContent from '~/content/faq.md?raw'
import { marked } from 'marked'

const content = await marked(FaqContent, {
    gfm: true,
    breaks: true,
})
</script>

<template>
    <div
        class="prose prose-sm prose-zinc dark:prose-invert w-full max-w-full"
        v-html="content"
    />
</template>
