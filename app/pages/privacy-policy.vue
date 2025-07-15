<script lang="ts" setup>
import PrivacyPolicyContent from '~/content/privacy-policy.md?raw'

defineSeo({
    title: 'プライバシーポリシー',
    description: 'Avatio のご利用におけるプライバシーポリシーについて',
})
</script>

<template>
    <Markdown :content="PrivacyPolicyContent" />
</template>
