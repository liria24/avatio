<script lang="ts" setup>
import TermsContent from '~/content/terms.md?raw'

defineSeo({
    title: '利用規約',
    description: 'Avatio のご利用における規約',
})
</script>

<template>
    <Markdown :content="TermsContent" />
</template>
