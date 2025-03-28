<script lang="ts" setup>
interface Props {
    items: { text: string; href?: string }[];
}
const props = defineProps<Props>();
</script>

<template>
    <div>
        <nav class="flex" aria-label="Breadcrumb">
            <ol class="flex flex-wrap items-center gap-1">
                <li class="flex items-center gap-1">
                    <NuxtLink
                        to="/"
                        class="p-1 rounded-lg flex hover:bg-zinc-200 hover:dark:bg-zinc-800"
                    >
                        <Icon
                            name="lucide:house"
                            size="16"
                            class="shrink-0 text-zinc-400 dark:text-zinc-500"
                        />
                    </NuxtLink>
                </li>
                <li
                    v-for="(item, index) in props.items"
                    :key="'breadcrumb-' + index"
                    class="group flex items-center gap-1"
                >
                    <Icon
                        name="lucide:chevron-right"
                        size="16"
                        class="text-zinc-400 dark:text-zinc-500"
                    />
                    <NuxtLink
                        :to="item.href"
                        :data-linked="item.href ? true : false"
                        :class="[
                            'p-1 rounded-lg flex',
                            'data-[linked=true]:hover:bg-zinc-200 data-[linked=true]:hover:dark:bg-zinc-800',
                            'text-xs group-last:font-bold leading-none whitespace-nowrap',
                            'text-zinc-500 dark:text-zinc-400',
                        ]"
                    >
                        {{ item.text }}
                    </NuxtLink>
                </li>
            </ol>
        </nav>
    </div>
</template>
