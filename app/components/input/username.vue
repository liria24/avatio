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
    ui?: {
        input?: InputProps
        field?: FormFieldProps
    }
}
const props = withDefaults(defineProps<Props>(), {
    label: undefined,
    placeholder: undefined,
    ui: undefined,
})

const { getSession, auth } = useAuth()
const session = await getSession()
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
        const available = await auth.isUsernameAvailable({
            username: username,
        })
        checkState.value = available ? 'available' : 'unavailable'
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
    }
)

watch(
    () => checkState.value,
    (state) => {
        if (state === 'available') available.value = true
        else available.value = false
    }
)
</script>

<template>
    <UFormField :label="props.label || $t('input.username.label')" v-bind="props.ui?.field">
        <UInput
            v-model="input"
            :placeholder="props.placeholder || $t('input.username.placeholder')"
            class="w-full"
            v-bind="props.ui?.input"
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
