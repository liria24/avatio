<script lang="ts" setup>
import FaqContent from '~/content/faq.md?raw'

defineSeo({
    title: 'FAQ',
    description: 'よくある質問',
})
</script>

<template>
    <Markdown :content="FaqContent" />
</template>
