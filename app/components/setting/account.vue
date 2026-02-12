<script lang="ts" setup>
interface Props {
    sectionId: string
}
const { sectionId } = defineProps<Props>()

const { auth, signOut, sessions } = useAuth()
const { deleteUser } = useUserSettingsAccount()

const modalDeleteUser = ref(false)
</script>

<template>
    <section :id="sectionId" class="flex flex-col gap-4">
        <h1 class="text-muted text-sm leading-none font-semibold text-nowrap">
            {{ $t('settings.account.title') }}
        </h1>

        <UCard>
            <div class="flex w-full flex-col gap-6">
                <UPageCard
                    :title="$t('settings.account.logoutOthers')"
                    :description="$t('settings.account.logoutOthersDesc')"
                    orientation="horizontal"
                    variant="naked"
                >
                    <UButton
                        :label="$t('settings.account.logoutOthersButton')"
                        color="neutral"
                        variant="subtle"
                        block
                        class="ml-auto w-fit min-w-48"
                        @click="auth.revokeOtherSessions()"
                    />
                </UPageCard>

                <UPageCard
                    v-if="(sessions?.length || 0) > 1"
                    :title="$t('settings.account.logoutAll')"
                    :description="$t('settings.account.logoutAllDesc')"
                    orientation="horizontal"
                    variant="naked"
                >
                    <UButton
                        :label="$t('settings.account.logoutAllButton')"
                        color="neutral"
                        variant="subtle"
                        block
                        class="ml-auto w-fit min-w-48"
                        @click="signOut()"
                    />
                </UPageCard>

                <UPageCard
                    :title="$t('settings.dangerZone.deleteAccount')"
                    :description="$t('settings.dangerZone.deleteAccountDesc')"
                    orientation="horizontal"
                    variant="naked"
                >
                    <UModal v-model:open="modalDeleteUser" :title="$t('modal.deleteAccount.title')">
                        <UButton
                            :label="$t('settings.dangerZone.deleteAccount')"
                            color="error"
                            variant="subtle"
                            block
                            class="ml-auto w-fit min-w-48"
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
                                    @click="modalDeleteUser = false"
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
                </UPageCard>
            </div>
        </UCard>
    </section>
</template>
