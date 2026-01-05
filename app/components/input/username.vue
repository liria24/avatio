<script lang="ts" setup>
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
}
const props = withDefaults(defineProps<Props>(), {
    label: 'ユーザーID',
    placeholder: 'ユーザーIDを入力',
})

const { $session, $authClient } = useNuxtApp()
const session = await $session()

const checkState = ref<
    'idle' | 'checking' | 'available' | 'unavailable' | 'error'
>('idle')

const stateMessages = {
    idle: { icon: '', message: '' },
    checking: { icon: 'svg-spinners:ring-resize', message: '確認中...' },
    available: { icon: 'lucide:check', message: '使用可能' },
    unavailable: {
        icon: 'lucide:x',
        message: 'このユーザーIDはすでに使用されています。',
    },
    error: {
        icon: 'lucide:alert-triangle',
        message: 'ユーザーIDの確認中にエラーが発生しました。',
    },
} as const

const checkNewIdAvailability = useDebounceFn(async (username: string) => {
    if (!username?.length || username === session.value!.user.username) {
        checkState.value = 'idle'
        return
    }

    checkState.value = 'checking'

    try {
        const available = await $authClient.isUsernameAvailable({
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
    <UFormField :label="props.label">
        <UInput
            v-model="input"
            :placeholder="props.placeholder"
            class="w-full"
        />
        <template #hint>
            <div v-if="checkState !== 'idle'" class="flex items-center gap-1">
                <Icon
                    :name="stateMessages[checkState].icon"
                    size="16"
                    class="text-toned"
                />
                <span class="text-toned text-xs">
                    {{ stateMessages[checkState].message }}
                </span>
            </div>
        </template>
    </UFormField>
</template>
