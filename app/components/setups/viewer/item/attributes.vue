<script lang="ts" setup>
interface Props {
    note: string | null;
    unsupported: boolean;
}

const { note, unsupported } = defineProps<Props>();
</script>

<template>
    <div
        v-if="note?.length || unsupported"
        class="px-3 py-2 flex flex-col gap-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 ring-inset ring-1 ring-zinc-300 dark:ring-zinc-700"
    >
        <div v-if="unsupported" class="gap-2 flex items-center">
            <Icon
                name="lucide:user-round-x"
                :size="15"
                class="shrink-0 mt-[0.2rem] text-zinc-400 dark:text-zinc-400"
            />
            <p
                class="text-xs leading-0 text-left text-zinc-400 dark:text-zinc-400"
            >
                アバター非対応
            </p>
        </div>
        <div v-if="note?.length" class="gap-2 flex items-start">
            <Icon
                name="lucide:pen-line"
                :size="15"
                class="shrink-0 mt-[0.2rem] text-zinc-400 dark:text-zinc-400"
            />
            <p
                class="text-xs/relaxed text-left break-keep whitespace-break-spaces [overflow-wrap:anywhere] text-zinc-900 dark:text-zinc-100"
            >
                {{ note }}
            </p>
        </div>
    </div>
</template>
