<script lang="ts" setup>
import type { ButtonProps } from '@nuxt/ui'

interface Props extends ButtonProps {
    username: string
}
const {
    username,
    disabled,
    icon,
    label,
    variant,
    block,
    color = 'neutral',
    size = 'lg',
    activeColor,
    activeVariant = 'outline',
    activeClass,
    ui = { label: 'mx-auto sm:mx-0 ' },
    class: className,
} = defineProps<Props>()

const { session } = useAuth()
const { login } = useAppOverlay()

const { isFollowing, follow, unfollow } = useUserFollow(username)

const isHovering = ref(false)

const computedLabel = computed(() => {
    if (label) return label
    if (!isFollowing.value) return 'フォロー'
    return isHovering.value ? 'フォロー解除' : 'フォロー中'
})
</script>

<template>
    <UButton
        :label="computedLabel"
        :icon
        :color
        :variant
        :size
        :block
        :disabled
        :active="isFollowing"
        :active-variant="activeVariant"
        :active-color="activeColor"
        :active-class="activeClass"
        :ui
        :class="
            cn(
                'rounded-full transition-all',
                isFollowing &&
                    'hover:bg-red-500/20 hover:ring-red-500/40 focus:bg-red-500/20 focus:ring-red-500/40',
                className,
            )
        "
        @mouseenter="isHovering = true"
        @mouseleave="isHovering = false"
        @click="session ? (isFollowing ? unfollow() : follow()) : login.open()"
    />
</template>
