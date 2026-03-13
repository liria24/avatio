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
const { label, placeholder, variant, color, size, ui } = defineProps<Props>()

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
        available.value = false
        return
    }

    checkState.value = 'checking'
    available.value = false

    try {
        const result = await auth.isUsernameAvailable({ username })
        checkState.value = result.data?.available ? 'available' : 'unavailable'
        available.value = result.data?.available ?? false
    } catch (error) {
        console.error('Error checking profile ID availability:', error)
        checkState.value = 'error'
        available.value = false
    }
}, 500)

watch(input, (id) => {
    if (id && id.length > 2) checkNewIdAvailability(id)
    else {
        checkState.value = 'idle'
        available.value = false
    }
})
</script>

<template>
    <UFormField :label="label || $t('input.username.label')" :ui="ui?.field">
        <div class="flex w-full items-center gap-1">
            <slot name="leading" :available />

            <UInput
                v-model="input"
                :placeholder="placeholder || $t('input.username.placeholder')"
                :variant
                :color
                :size
                class="w-full"
                :ui="ui?.input"
            />

            <slot name="trailing" :available />
        </div>

        <template #help>
            <UPopover
                :content="{ align: 'start' }"
                :ui="{ content: 'p-4 max-w-md w-[90dvw] bg-accented' }"
                class="min-w-0"
            >
                <UButton
                    icon="mingcute:alert-fill"
                    :label="$t('input.username.changeWarning')"
                    variant="link"
                    size="sm"
                    class="p-0"
                />

                <template #content>
                    <span class="font-medium">{{ $t('input.username.changeWarning') }}</span>
                    <p class="text-toned mt-2 text-xs">
                        {{ $t('input.username.changeWarningDescription') }}
                    </p>
                </template>
            </UPopover>
        </template>

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
