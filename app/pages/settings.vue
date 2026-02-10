<script lang="ts" setup>
definePageMeta({
    middleware: 'session',
})

const { auth, signOut, getSessions } = useAuth()
const { accountState, deleteUser: deleteUserAction } = useUserSettings()
const { t } = useI18n()

const sessions = await getSessions()
const toast = useToast()

const deleteUser = async () => {
    await deleteUserAction()
}

defineSeo({
    title: t('settings.title'),
    description: t('settings.description'),
})
</script>

<template>
    <div class="flex flex-col gap-6">
        <h1 class="text-lg font-medium text-nowrap">{{ $t('settings.title') }}</h1>

        <SettingProfile />

        <SettingShop />

        <UCard>
            <template #header>
                <h2 class="text-lg leading-none font-semibold text-nowrap">
                    {{ $t('settings.account.title') }}
                </h2>
            </template>

            <div class="flex w-full flex-col gap-6">
                <div class="flex w-full items-center justify-between gap-2">
                    <div class="flex flex-col gap-1">
                        <h3 class="text-sm font-semibold">
                            {{ $t('settings.account.logoutOthers') }}
                        </h3>
                        <p class="text-muted text-xs">
                            {{ $t('settings.account.logoutOthersDesc') }}
                        </p>
                    </div>
                    <UButton
                        :label="$t('settings.account.logoutOthersButton')"
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
                        <h3 class="text-sm font-semibold">
                            {{ $t('settings.account.logoutAll') }}
                        </h3>
                        <p class="text-muted text-xs">
                            {{ $t('settings.account.logoutAllDesc') }}
                        </p>
                    </div>
                    <UButton
                        :label="$t('settings.account.logoutAllButton')"
                        color="neutral"
                        variant="subtle"
                        @click="signOut()"
                    />
                </div>
            </div>
        </UCard>

        <UCard variant="soft">
            <template #header>
                <h2 class="text-lg leading-none font-semibold text-nowrap">
                    {{ $t('settings.dangerZone.title') }}
                </h2>
            </template>

            <div class="flex w-full items-center justify-between gap-2">
                <div class="flex flex-col gap-1">
                    <h3 class="text-sm font-semibold">
                        {{ $t('settings.dangerZone.deleteAccount') }}
                    </h3>
                    <p class="text-muted text-xs">
                        {{ $t('settings.dangerZone.deleteAccountDesc') }}
                    </p>
                </div>
                <UModal
                    v-model:open="accountState.modalDeleteUser"
                    :title="$t('modal.deleteAccount.title')"
                >
                    <UButton
                        :label="$t('settings.dangerZone.deleteAccount')"
                        color="error"
                        variant="subtle"
                    />

                    <template #body>
                        <UAlert
                            icon="mingcute:delete-2-fill"
                            :title="$t('modal.deleteAccount.confirm')"
                            :description="$t('modal.deleteAccount.description')"
                            color="error"
                            variant="subtle"
                        />
                    </template>

                    <template #footer>
                        <div class="flex w-full items-center justify-end gap-2">
                            <UButton
                                :label="$t('cancel')"
                                variant="ghost"
                                @click="accountState.modalDeleteUser = false"
                            />
                            <UButton
                                :label="$t('delete')"
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
