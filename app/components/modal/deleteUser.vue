<script lang="ts" setup>
const vis = defineModel<boolean>({
    default: false,
})

const emit = defineEmits(['accept', 'close'])

const status = ref<'idle' | 'loading' | 'error'>('idle')
const error = ref<string>('')
// const password = ref<string>('');
const deletable = ref<boolean>(false)

const deleteUser = async () => {
    status.value = 'loading'
    error.value = ''

    try {
        const res = await $fetch('/api/user', {
            method: 'DELETE',
            // body: { plainPassword: password.value },
        })
        console.log(res)
        if (!res) throw new Error('Failed to delete user')

        await useSignOut()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        console.error(e)
        status.value = 'error'
        if (e.statusCode === 401) {
            error.value = 'パスワードが違います'
        } else if (e.statusCode === 403) {
            error.value = '認証に失敗しました'
        } else {
            error.value = 'エラーが発生しました'
        }
    }
}

const cancel = () => {
    status.value = 'idle'
    error.value = ''
    emit('close')
}

watch(vis, () => {
    status.value = 'idle'
    // password.value = '';
    error.value = ''
    deletable.value = false

    setTimeout(() => {
        deletable.value = true
    }, 3000)
})
</script>

<template>
    <Modal v-model="vis">
        <template #header>
            <UiTitle label="アカウント削除" icon="lucide:circle-alert" />
        </template>

        <div v-if="status === 'idle'" class="flex flex-col gap-6 px-3">
            <div class="flex flex-col gap-2 text-sm">
                <p>アカウントに関連するデータは、直ちにすべて削除されます。</p>
                <p>削除したアカウントおよびデータは復元できません。</p>
                <p class="text-xs text-zinc-400">
                    アカウント・データの復元に関するお問い合わせには、一切対応いたしません。
                </p>
            </div>

            <!-- <div class="gap-2 flex flex-col">
                <p class="text-sm">
                    続行するにはパスワードを入力してください。
                </p>
                <UInput
                    v-model="password"
                    type="password"
                    placeholder="パスワード"
                />
            </div> -->
        </div>

        <div v-else-if="status === 'loading'" class="flex flex-col gap-6 px-3">
            <Icon name="svg-spinners:ring-resize" />
        </div>

        <div v-else-if="status === 'error'" class="flex flex-col gap-6 px-3">
            <p class="text-sm">{{ error }}</p>
        </div>

        <template #footer>
            <div class="flex w-full items-center justify-between gap-2">
                <Button
                    v-if="status !== 'loading'"
                    label="キャンセル"
                    variant="flat"
                    @click="cancel"
                />

                <Button
                    v-if="status === 'idle'"
                    :disabled="!deletable"
                    label="削除"
                    class="text-red-500 hover:bg-red-500 hover:text-white hover:outline-red-400 disabled:text-red-200 disabled:hover:bg-transparent dark:text-red-400 hover:dark:bg-red-800 hover:dark:text-white hover:dark:outline-red-700"
                    @click="deleteUser"
                />
            </div>
        </template>
    </Modal>
</template>
