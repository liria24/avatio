<script setup lang="ts">
interface Props {
    content: string
}
const { content } = defineProps<Props>()
</script>

<template>
    <div>
        <MDC
            :value="content"
            :parser-options="{
                toc: false,
                contentHeading: false,
            }"
            class="sentence w-full max-w-full *:first:mt-0 *:last:mb-0 [&_img]:max-w-lg"
        />
    </div>
</template>
