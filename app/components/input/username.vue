<script lang="ts" setup>
import type { FormFieldProps, InputProps } from '@nuxt/ui'

const input = defineModel<string>({
    default: '',
    required: true,
})

const available = defineModel<boolean>('available', {
    default: false,
})

interface Props {
    label?: string
    placeholder?: string
    variant?: InputProps['variant']
    color?: InputProps['color']
    size?: InputProps['size']
    ui?: {
        input?: InputProps['ui']
        field?: FormFieldProps['ui']
    }
}
const { label, placeholder, ui } = defineProps<Props>()

const { session, auth } = useAuth()
const { t } = useI18n()

const checkState = ref<'idle' | 'checking' | 'available' | 'unavailable' | 'error'>('idle')

const stateMessages = computed(() => ({
    idle: { icon: '', message: '' },
    checking: { icon: 'svg-spinners:ring-resize', message: t('input.username.checking') },
    available: { icon: 'mingcute:check-line', message: t('input.username.available') },
    unavailable: {
        icon: 'mingcute:close-line',
        message: t('input.username.unavailable'),
    },
    error: {
        icon: 'mingcute:alert-fill',
        message: t('input.username.error'),
    },
}))

const checkNewIdAvailability = useDebounceFn(async (username: string) => {
    if (!username?.length || username === session.value!.user.username) {
        checkState.value = 'idle'
        return
    }

    checkState.value = 'checking'

    try {
        const available = await auth.isUsernameAvailable({ username })
        checkState.value = available.data?.available ? 'available' : 'unavailable'
    } catch (error) {
        console.error('Error checking profile ID availability:', error)
        checkState.value = 'error'
    }
}, 500)

watch(
    () => input.value,
    (id) => {
        if (id && id.length > 2) checkNewIdAvailability(id)
        else checkState.value = 'idle'
    },
)

watch(
    () => checkState.value,
    (state) => {
        if (state === 'available') available.value = true
        else available.value = false
    },
)
</script>

<template>
    <UFormField :label="label || $t('input.username.label')" :ui="ui?.field">
        <UInput
            v-model="input"
            :placeholder="placeholder || $t('input.username.placeholder')"
            class="w-full"
            :ui="ui?.input"
        />
        <template #hint>
            <div v-if="checkState !== 'idle'" class="flex items-center gap-1">
                <Icon :name="stateMessages[checkState].icon" size="16" class="text-toned" />
                <span class="text-toned text-xs">
                    {{ stateMessages[checkState].message }}
                </span>
            </div>
        </template>
    </UFormField>
</template>
