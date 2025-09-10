<script lang="ts" setup>
import PrivacyPolicyContent from '~/content/privacy-policy.md?raw'

defineSeo({
    title: 'プライバシーポリシー',
    description: 'Avatio のご利用におけるプライバシーポリシーについて',
    image: 'https://avatio.me/ogp.png',
})
</script>

<template>
    <MDC :value="PrivacyPolicyContent" class="w-full max-w-full" />
</template>
