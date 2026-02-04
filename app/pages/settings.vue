<script lang="ts" setup>
definePageMeta({
    middleware: 'session',
})

const { auth, signOut, getSessions } = useAuth()
const { accountState, deleteUser: deleteUserAction } = useUserSettings()

const sessions = await getSessions()
const toast = useToast()

const deleteUser = async () => {
    await deleteUserAction()
}

defineSeo({
    title: 'ユーザー設定',
    description: 'ユーザープロフィールの編集や、アカウントに関する操作を行うことができます。',
})
</script>

<template>
    <div class="flex flex-col gap-6">
        <h1 class="text-lg font-medium text-nowrap">ユーザー設定</h1>

        <SettingProfile />

        <SettingShop />

        <UCard>
            <template #header>
                <h2 class="text-lg leading-none font-semibold text-nowrap">アカウント</h2>
            </template>

            <div class="flex w-full flex-col gap-6">
                <div class="flex w-full items-center justify-between gap-2">
                    <div class="flex flex-col gap-1">
                        <h3 class="text-sm font-semibold">このブラウザ以外からログアウト</h3>
                        <p class="text-muted text-xs">
                            現在使用しているブラウザ以外のすべてのデバイスからログアウトします。
                        </p>
                    </div>
                    <UButton
                        label="すべてのデバイスからログアウト"
                        color="neutral"
                        variant="subtle"
                        @click="auth.revokeOtherSessions()"
                    />
                </div>

                <div
                    v-if="(sessions?.length || 0) > 1"
                    class="flex w-full items-center justify-between gap-2"
                >
                    <div class="flex flex-col gap-1">
                        <h3 class="text-sm font-semibold">すべてのアカウントからログアウト</h3>
                        <p class="text-muted text-xs">
                            同時にログインしているすべてのアカウントからログアウトします。
                        </p>
                    </div>
                    <UButton
                        label="すべてログアウト"
                        color="neutral"
                        variant="subtle"
                        @click="signOut()"
                    />
                </div>
            </div>
        </UCard>

        <UCard variant="soft">
            <template #header>
                <h2 class="text-lg leading-none font-semibold text-nowrap">DANGER ZONE</h2>
            </template>

            <div class="flex w-full items-center justify-between gap-2">
                <div class="flex flex-col gap-1">
                    <h3 class="text-sm font-semibold">アカウント削除</h3>
                    <p class="text-muted text-xs">
                        アカウントおよびアカウントに紐づくデータをすべて削除します。<br />
                        削除したアカウントは復元できません。
                    </p>
                </div>
                <UModal v-model:open="accountState.modalDeleteUser" title="アカウント削除">
                    <UButton label="アカウント削除" color="error" variant="subtle" />

                    <template #body>
                        <UAlert
                            icon="mingcute:delete-2-fill"
                            title="本当にアカウントを削除しますか？"
                            description="削除したアカウントは復元できません。"
                            color="error"
                            variant="subtle"
                        />
                    </template>

                    <template #footer>
                        <div class="flex w-full items-center justify-end gap-2">
                            <UButton
                                label="キャンセル"
                                variant="ghost"
                                @click="accountState.modalDeleteUser = false"
                            />
                            <UButton
                                label="削除"
                                color="error"
                                variant="solid"
                                loading-auto
                                @click="deleteUser"
                            />
                        </div>
                    </template>
                </UModal>
            </div>
        </UCard>
    </div>
</template>
