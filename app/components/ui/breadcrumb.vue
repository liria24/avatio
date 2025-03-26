<script lang="ts" setup>
interface Props {
    items: { text: string; href?: string }[];
}
const props = defineProps<Props>();

const breadcrumb = [
    {
        text: 'ホーム',
        href: '/',
    },
    ...props.items,
];
</script>

<template>
    <div>
        <nav class="flex" aria-label="Breadcrumb">
            <ol class="inline-flex items-center">
                <li
                    v-for="(item, index) in breadcrumb"
                    :key="'breadcrumb-' + index"
                    class="inline-flex items-center"
                >
                    <NuxtLink
                        :to="item.href"
                        :data-linked="item.href ? true : false"
                        :class="[
                            'text-xs font-bold leading-none whitespace-nowrap',
                            'text-zinc-500 dark:text-zinc-400 data-[linked=true]:hover:text-zinc-700 data-[linked=true]:dark:hover:text-zinc-300',
                        ]"
                    >
                        {{ item.text }}
                    </NuxtLink>
                    <Icon
                        v-if="index < breadcrumb.length - 1"
                        name="lucide:chevron-right"
                        size="16"
                        class="mx-2 text-zinc-400 dark:text-zinc-500"
                    />
                </li>
            </ol>
        </nav>
    </div>
</template>
