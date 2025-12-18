<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import { Primitive } from 'reka-ui'
import { loadDefaultJapaneseParser } from 'budoux'

interface Props extends PrimitiveProps {
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
    <Primitive :as="props.as" class="wrap-anywhere break-keep">
        <span v-html="lineBreak(props.content)" />
    </Primitive>
</template>
