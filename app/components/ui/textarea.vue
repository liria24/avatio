<script lang="ts" setup>
import { twMerge } from 'tailwind-merge'
const { textarea } = useTextareaAutosize()

interface Props {
    unstyled?: boolean
    disabled?: boolean
    autoresize?: boolean
    placeholder?: string
    rows?: number
    class?: string | string[]
}
const props = defineProps<Props>()

const model = defineModel<string>()

const emit = defineEmits(['input', 'change', 'blur'])
</script>

<template>
    <div
        :class="
            twMerge(
                unstyled
                    ? ''
                    : twMerge(
                          'rounded-lg px-2.5 py-2 ring-1 ring-zinc-400 ring-inset focus-within:ring-2 focus-within:ring-zinc-700 hover:ring-2 dark:ring-zinc-700',
                          'transition-all duration-100 ease-in-out'
                      ),
                props.class
            )
        "
    >
        <textarea
            :id="useId()"
            ref="textarea"
            v-model="model"
            :rows="props.rows ?? 3"
            :disabled="props.disabled"
            :placeholder="props.placeholder"
            class="block w-full resize-none bg-transparent text-sm placeholder-zinc-400 focus:outline-hidden dark:placeholder-zinc-500"
            @input="emit('input', $event)"
            @blur="emit('blur', $event)"
            @change="emit('change', $event)"
        />
    </div>
</template>
