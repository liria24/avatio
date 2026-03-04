<script setup lang="ts">
interface Props {
    title?: string
    description?: string
}
const { title = 'title', description } = defineProps<Props>()
</script>

<template>
    <div
        style="font-family: 'Geist', 'Noto Sans JP', sans-serif"
        class="flex h-full w-full flex-col items-start justify-between gap-16 bg-zinc-100 p-20"
    >
        <div class="flex flex-col gap-8">
            <h1 class="text-8xl font-medium text-zinc-950">
                {{ title }}
            </h1>

            <p v-if="description" class="text-2xl text-zinc-700">
                {{ description }}
            </p>
        </div>

        <Icon name="avatio:avatio" mode="svg" class="ml-auto size-16" />
    </div>
</template>
