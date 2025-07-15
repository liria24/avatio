<script setup lang="ts">
interface Props {
    content: string
    size?: 'sm' | 'md' | 'lg'
    class?: string | string[]
}
const props = withDefaults(defineProps<Props>(), {
    size: 'md',
    class: '',
})
</script>

<template>
    <MDC
        :value="useLineBreak(props.content)"
        :class="
            cn(
                'prose prose-sm prose-zinc dark:prose-invert',
                props.size === 'md' &&
                    'prose-h1:text-5xl prose-h2:text-2xl prose-h3:text-lg prose-p:first:my-0',
                'w-full max-w-full wrap-anywhere break-keep',
                props.class
            )
        "
    />
</template>
