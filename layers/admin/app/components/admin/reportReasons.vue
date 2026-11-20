<script setup lang="ts">
defineProps<{
    labels: string[]
    comment?: string | null
}>()
</script>

<template>
    <div class="flex w-full flex-col gap-2">
        <div class="flex flex-wrap items-center gap-1">
            <UBadge
                v-for="label in labels"
                :key="label"
                :label="$t(label)"
                variant="outline"
                class="rounded-full px-2"
            />
        </div>

        <p
            v-if="comment?.length"
            class="text-toned ring-muted w-full rounded-xl px-3 py-1.5 text-sm break-words whitespace-pre-wrap ring-1"
        >
            {{ comment }}
        </p>
    </div>
</template>
