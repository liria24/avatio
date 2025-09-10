<script lang="ts" setup>
import TermsContent from '~/content/terms.md?raw'

defineSeo({
    title: '利用規約',
    description: 'Avatio のご利用における規約',
    image: 'https://avatio.me/ogp.png',
})
</script>

<template>
    <MDC :value="TermsContent" class="w-full max-w-full" />
</template>
