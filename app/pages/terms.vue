<script lang="ts" setup>
import TermsContent from '~/content/terms.md?raw'
import { marked } from 'marked'

const content = await marked(TermsContent, {
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
