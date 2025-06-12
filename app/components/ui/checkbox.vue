<script lang="ts" setup>
import { twMerge } from 'tailwind-merge'

interface Props {
    label?: string
}
const props = defineProps<Props>()

const model = defineModel<boolean>({
    default: false,
})
const inputId = useId()
</script>

<template>
    <div class="relative flex items-start">
        <input
            :id="inputId"
            v-model="model"
            type="checkbox"
            :class="
                twMerge(
                    'form-checkbox size-4 rounded-sm bg-white dark:bg-zinc-800',
                    'checked:bg-zinc-700 dark:checked:border-transparent',
                    'focus-visible:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-zinc-400 dark:focus-visible:ring-offset-zinc-900',
                    'focus:bg-zinc-700 focus:ring-0 focus:ring-transparent focus:ring-offset-transparent'
                )
            "
        />
        <label
            v-if="props.label"
            :for="inputId"
            class="ms-3 text-xs font-medium text-zinc-700 dark:text-zinc-200"
        >
            {{ props.label }}
        </label>
    </div>
</template>
