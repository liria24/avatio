<script lang="ts" setup>
import { twMerge } from 'tailwind-merge';

interface Props {
    url: string;
    alt: string;
    ariaHidden?: 'false' | 'true';
    iconSize?: number;
    class?: string | string[];
}

const props = defineProps<Props>();
</script>

<template>
    <AvatarRoot
        :class="
            twMerge(
                'shrink-0 flex rounded-full items-center justify-center bg-zinc-200 dark:bg-zinc-700',
                props.class
            )
        "
    >
        <AvatarImage
            class="h-full w-full rounded-[inherit] object-cover"
            :src="props.url"
            :alt="props.alt"
            :aria-hidden="props.ariaHidden"
        />
        <AvatarFallback as-child :delay-ms="0">
            <Icon
                name="lucide:user-round"
                :size="props.iconSize ?? 18"
                class="text-neutral-600 dark:text-neutral-300"
            />
        </AvatarFallback>
    </AvatarRoot>
</template>
