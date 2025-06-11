<script lang="ts" setup>
const modalDeleteUser = ref<boolean>(false)
</script>

<template>
    <div class="flex flex-col gap-3">
        <!-- <div
            class="gap-3 p-3 mt-6 rounded-lg flex flex-col border border-zinc-300 dark:border-zinc-400"
        >
            <UiTitle
                label="アカウント操作"
                icon="lucide:circle-alert"
                is="h2"
            />
            <div class="w-full pl-3 flex gap-2 justify-between items-center">
                <div class="flex flex-col gap-1">
                    <h3 class="text-sm font-semibold">パスワード変更</h3>
                </div>
                <Button
                    label="パスワード変更"
                    class="text-red-500 dark:text-red-400 hover:text-white hover:dark:text-white hover:bg-red-500 hover:dark:bg-red-800 hover:outline-red-400 hover:dark:outline-red-700"
                    @click="modalDeleteUser = true"
                />
            </div>
        </div> -->

        <div
            class="flex flex-col gap-3 rounded-lg border border-red-300 p-3 dark:border-red-400"
        >
            <UiTitle label="DANGER ZONE" icon="lucide:circle-alert" is="h2" />
            <div class="flex w-full items-center justify-between gap-2 pl-3">
                <div class="flex flex-col gap-1">
                    <h3 class="text-sm font-semibold">アカウント削除</h3>
                    <p class="text-xs">
                        アカウントおよびアカウントに紐づくデータをすべて削除します。<br />
                        削除したアカウントは復元できません。
                    </p>
                </div>
                <Button
                    label="アカウント削除"
                    class="text-red-500 hover:bg-red-500 hover:text-white hover:outline-red-400 dark:text-red-400 hover:dark:bg-red-800 hover:dark:text-white hover:dark:outline-red-700"
                    @click="modalDeleteUser = true"
                />
            </div>
        </div>
    </div>

    <ModalDeleteUser
        v-model="modalDeleteUser"
        @close="modalDeleteUser = false"
    />
</template>
