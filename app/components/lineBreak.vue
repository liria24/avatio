<script setup lang="ts">
import { loadDefaultJapaneseParser } from 'budoux'

interface Props {
    content: string
}
const props = defineProps<Props>()

const lineBreak = (text: string) => {
    const { locale } = useI18n()
    const jaParser = loadDefaultJapaneseParser()

    if (locale.value === 'ja') return jaParser.parse(text).join('<wbr>')
    else return text
}
</script>

<template>
    <span class="wrap-anywhere break-keep" v-html="lineBreak(props.content)" />
</template>
