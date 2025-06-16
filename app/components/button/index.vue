<script setup lang="ts">
import { twMerge } from 'tailwind-merge'

interface Props {
    id?: string
    disabled?: boolean
    tabindex?: number
    type?: 'button' | 'submit' | 'reset'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    to?: any
    newTab?: boolean
    icon?: string
    iconSize?: number
    label?: string
    ariaLabel?: string
    variant?: 'outline' | 'flat' | 'link'
    tooltip?: string
    class?: string | string[]
    iconClass?: string
}
const props = withDefaults(defineProps<Props>(), {
    disabled: false,
    tabindex: 0,
    type: 'button',
    newTab: false,
    icon: '',
    iconSize: 18,
    label: '',
    ariaLabel: '',
    variant: 'outline',
    tooltip: '',
})

const emit = defineEmits(['click'])

const Link = defineNuxtLink({
    componentName: 'Link',
    prefetch: false,
})

const variantClass = {
    outline:
        'outline outline-1 outline-zinc-400 dark:outline-zinc-600 focus:outline-zinc-600 focus:outline-2',
    flat: 'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-600 dark:focus-visible:ring-zinc-400',
    link: 'p-1 text-xs font-semibold text-zinc-600 hover:text-zinc-400 dark:text-zinc-400 hover:dark:text-zinc-500 hover:bg-transparent hover:dark:bg-transparent',
}
</script>

<template>
    <UTooltip :text="props.tooltip" :delay-duration="0">
        <component
            :id="props.id"
            :tabindex="props.tabindex"
            :is="props.to ? Link : 'button'"
            :type="props.type"
            :to="props.to"
            :target="props.newTab ? '_blank' : '_self'"
            no-rel
            :disabled="props.disabled"
            :aria-label="props.ariaLabel"
            :class="
                twMerge(
                    props.disabled ? 'cursor-not-allowed' : 'cursor-pointer',
                    props.icon.length ? 'p-3' : 'px-4 py-3',
                    'flex items-center justify-center gap-2 rounded-lg',
                    'align-middle text-sm leading-none font-semibold',
                    'bg-transparent dark:bg-transparent',
                    'text-zinc-800 dark:text-zinc-200',
                    props.disabled
                        ? 'text-zinc-400 dark:text-zinc-600'
                        : 'hover:bg-zinc-200 dark:hover:bg-zinc-600',
                    'transition duration-100 ease-in-out',
                    variantClass[props.variant],
                    props.class
                )
            "
            @click="emit('click')"
        >
            <slot>
                <Icon
                    v-if="props.icon.length"
                    :name="props.icon"
                    :size="props.iconSize"
                    :class="twMerge('shrink-0', props.iconClass)"
                />

                <p
                    v-if="props.label.length"
                    class="leading-none whitespace-nowrap empty:hidden"
                >
                    {{ props.label }}
                </p>
            </slot>
        </component>
    </UTooltip>
</template>
