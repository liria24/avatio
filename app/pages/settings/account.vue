<script lang="ts" setup>
definePageMeta({
    middleware: 'authed',
})

const toast = useToast()
const { t, localeProperties } = useI18n()
const localePath = useLocalePath()
const { auth, session, sessions, signOut } = useAuth()

const modalDeleteUser = ref(false)

const { data: linkedAccounts } = await useFetch('/api/users/me/accounts')

const providers: Record<string, { name: string; icon: string }> = {
    twitter: {
        name: 'X (Twitter)',
        icon: 'mingcute:social-x-fill',
    },
    credential: {
        name: 'Email/Password',
        icon: 'mingcute:user-4-fill',
    },
}

const deleteUser = async () => {
    try {
        await auth.deleteUser({ callbackURL: localePath('/') })

        toast.add({
            icon: 'mingcute:check-line',
            title: t('settings.account.toast.deleted'),
            description: t('settings.account.toast.deleteDescription'),
            color: 'success',
        })
        navigateTo(localePath('/'), { external: true })
    } catch (error) {
        console.error('Error deleting user:', error)
        toast.add({
            icon: 'mingcute:close-line',
            title: t('settings.account.toast.deleteFailed'),
            description: t('settings.account.toast.deleteFailedDescription'),
            color: 'error',
        })
    }
}

useSeo({
    title: t('settings.title'),
    description: t('settings.description'),
})
</script>

<template>
    <NuxtLayout name="settings" :title="$t('settings.account.title')">
        <UAlert
            v-if="session?.user.role === 'admin'"
            icon="mingcute:shield-shape-fill"
            :title="$t('settings.account.adminBanner')"
            variant="soft"
            color="neutral"
        />

        <section id="linked" class="flex flex-col gap-4">
            <h3 class="text-muted text-sm leading-none font-semibold text-nowrap">
                {{ $t('settings.account.linkedAccounts') }}
            </h3>

            <UCard :ui="{ body: 'flex flex-col gap-6' }">
                <div
                    v-for="account in linkedAccounts"
                    :key="account.providerId"
                    class="flex items-center gap-3"
                >
                    <Icon
                        :name="providers[account.providerId]?.icon || 'mingcute:question-fill'"
                        size="24"
                    />
                    <span class="font-medium">
                        {{ providers[account.providerId]?.name }}
                    </span>
                    <UBadge
                        icon="mingcute:check-line"
                        :label="
                            $t('settings.account.linked', {
                                date: new Date(account.createdAt).toLocaleDateString(
                                    localeProperties.language,
                                ),
                            })
                        "
                        size="lg"
                        variant="soft"
                        class="ml-auto"
                    />
                </div>
            </UCard>
        </section>

        <section id="manage" class="flex flex-col gap-6 px-2">
            <h3 class="text-muted text-sm leading-none font-semibold text-nowrap">
                {{ $t('settings.account.manage') }}
            </h3>

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
                :title="$t('settings.account.deleteAccount')"
                :description="$t('settings.account.deleteAccountDesc')"
                orientation="horizontal"
                variant="naked"
            >
                <UModal v-model:open="modalDeleteUser" :title="$t('modal.deleteAccount.title')">
                    <UButton
                        :label="$t('settings.account.deleteAccount')"
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
        </section>
    </NuxtLayout>
</template>
