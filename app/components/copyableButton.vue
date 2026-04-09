<script setup lang="ts">
import type { ButtonProps } from '@nuxt/ui'

interface Props extends ButtonProps {
    value?: string
    copyable?: boolean
}
const props = withDefaults(defineProps<Props>(), {
    copyable: true,
})
defineOptions({ inheritAttrs: false })

// attrs contains only event handlers and non-prop attributes (e.g. onClick, class)
const attrs = useAttrs()
const { copy, copied } = useClipboard()

const isHovered = ref(false)

const hasOriginalIcon = computed(() => !!(props.icon || props.leadingIcon))

const resolvedAttrs = computed((): ButtonProps => {
    // Strip our custom props before forwarding to UButton
    const { value: _v, copyable: _c, ...buttonProps } = props

    if (!props.copyable) return { ...attrs, ...buttonProps }

    const showCheck = copied.value
    const showCopy = isHovered.value && !copied.value

    if (hasOriginalIcon.value) {
        const { icon: _i, leadingIcon: _l, ...rest } = buttonProps
        if (showCheck) return { ...attrs, ...rest, icon: 'mingcute:check-line' }
        if (showCopy) return { ...attrs, ...rest, icon: 'mingcute:copy-2-fill' }
        return { ...attrs, ...buttonProps }
    }

    const existingUi = props.ui ?? {}
    const iconName = showCheck ? 'mingcute:check-line' : 'mingcute:copy-2-fill'
    const iconVisible = showCheck || showCopy
    return {
        ...attrs,
        ...buttonProps,
        icon: iconName,
        ui: {
            ...existingUi,
            leadingIcon: [
                existingUi.leadingIcon,
                !iconVisible && 'opacity-0',
                'transition-opacity',
            ],
        },
    }
})

const handleClick = () => {
    if (!props.copyable) return
    copy(props.value ?? props.label ?? '')
}
</script>

<template>
    <UButton
        v-bind="resolvedAttrs"
        @click="handleClick"
        @mouseenter="isHovered = true"
        @mouseleave="isHovered = false"
    >
        <template v-for="name in Object.keys($slots)" :key="name" #[name]>
            <slot :name="name" />
        </template>
    </UButton>
</template>
