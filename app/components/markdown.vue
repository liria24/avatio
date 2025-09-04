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
        :class="cn('w-full max-w-full wrap-anywhere break-keep', props.class)"
    />
</template>
