<script lang="ts" setup>
import { twMerge } from 'tailwind-merge';

const model = defineModel<number>({ default: 0 });

interface Prop {
    id?: string;
    type?: string;
    unstyled?: boolean;
    icon?: string;
    iconSize?: string | number;
    disabled?: boolean;
    max?: number;
    min?: number;
    step?: number;
    disableWheelChange?: boolean;
    class?: string | string[];
}
const props = defineProps<Prop>();
</script>

<template>
    <div
        :class="
            twMerge(
                props.unstyled
                    ? 'flex items-center gap-2'
                    : twMerge(
                          'px-2.5 py-2 rounded-lg flex items-center gap-2',
                          'text-sm text-black dark:text-white',
                          'ring-inset ring-1 hover:ring-2 focus-within:ring-2 ring-zinc-400 dark:ring-zinc-700 focus-within:ring-zinc-700',
                          'transition-all duration-100 ease-in-out'
                      ),
                props.class
            )
        "
    >
        <Icon
            v-if="props.icon"
            :name="props.icon"
            :size="props.iconSize || 18"
            class="text-zinc-400 dark:text-zinc-500"
        />
        <NumberFieldRoot
            v-model="model"
            :id="props.id"
            :disabled="props.disabled"
            :disable-wheel-change="props.disableWheelChange"
            :max="props.max"
            :min="props.min"
            :step="props.step"
        >
            <NumberFieldInput
                class="grow min-w-0 focus:outline-hidden placeholder:select-none bg-transparent placeholder-zinc-400 dark:placeholder-zinc-500"
            />
        </NumberFieldRoot>

        <slot name="trailing" />
    </div>
</template>
