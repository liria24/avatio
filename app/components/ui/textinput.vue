<script lang="ts" setup>
import { twMerge } from 'tailwind-merge'

const model = defineModel<string>({ default: '' })

interface Prop {
    id?: string
    type?: string
    unstyled?: boolean
    icon?: string
    iconSize?: string | number
    placeholder?: string
    disabled?: boolean
    autocomplete?: string
    autofocus?: boolean
    class?: string | string[]
}
const props = defineProps<Prop>()

const emit = defineEmits(['input', 'change', 'blur'])
</script>

<template>
    <div
        :class="
            twMerge(
                props.unstyled
                    ? 'flex items-center gap-2'
                    : twMerge(
                          'flex items-center gap-2 rounded-lg px-2.5 py-2',
                          'text-sm text-black dark:text-white',
                          'ring-1 ring-zinc-400 ring-inset focus-within:ring-2 focus-within:ring-zinc-700 hover:ring-2 dark:ring-zinc-700',
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
        <input
            :id="props.id"
            ref="input"
            :type="props.type || 'text'"
            v-model="model"
            :placeholder="props.placeholder"
            :disabled="props.disabled"
            :autocomplete="props.autocomplete"
            :autofocus="props.autofocus"
            class="min-w-0 grow bg-transparent placeholder-zinc-400 placeholder:select-none focus:outline-hidden dark:placeholder-zinc-500"
            @input="emit('input', $event)"
            @blur="emit('blur', $event)"
            @change="emit('change', $event)"
        />

        <slot name="trailing" />
    </div>
</template>
