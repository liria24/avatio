<script lang="ts" setup>
const input = defineModel<string>({
    default: '',
    required: true,
})

const available = defineModel<boolean>('available', {
    default: false,
})

const { $session } = useNuxtApp()
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

const checkNewIdAvailability = useDebounceFn(async (id: string) => {
    if (!id?.length || id === session.value!.user.id) {
        checkState.value = 'idle'
        return
    }

    const validateResult = userUpdateSchema.shape.id.safeParse(id)
    if (!validateResult.success) {
        checkState.value = 'idle'
        return
    }

    checkState.value = 'checking'

    try {
        const response = await $fetch('/api/users/id-availability', {
            query: { id },
        })
        checkState.value = response.available ? 'available' : 'unavailable'
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
    <UFormField label="新しいユーザーID">
        <UInput
            v-model="input"
            placeholder="新しいユーザーIDを入力"
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
