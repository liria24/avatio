<script setup lang="ts">
interface Props {
    content: string
}
const props = defineProps<Props>()
</script>

<template>
    <MDC
        :value="useLineBreak(props.content)"
        :class="
            cn(
                'prose prose-sm prose-zinc dark:prose-invert',
                'prose-h1:text-5xl',
                'prose-h2:text-2xl',
                'prose-h3:text-lg',
                'prose-p:first:my-0',
                'w-full max-w-full wrap-anywhere break-keep'
            )
        "
    />
</template>
