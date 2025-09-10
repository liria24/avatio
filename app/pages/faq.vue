<script lang="ts" setup>
import FaqContent from '~/content/faq.md?raw'

defineSeo({
    title: 'FAQ',
    description: 'よくある質問',
    image: 'https://avatio.me/ogp.png',
})
</script>

<template>
    <MDC :value="FaqContent" class="w-full max-w-full" />
</template>
