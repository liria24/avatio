<script lang="ts" setup>
import FaqContent from '~/content/faq.md?raw'

const { app } = useAppConfig()

defineSeo({
    title: 'FAQ',
    description: 'よくある質問',
    image: `${app.site}/ogp.png`,
})
</script>

<template>
    <MDC :value="FaqContent" class="w-full max-w-full" />
</template>
