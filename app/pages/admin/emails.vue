<script lang="ts" setup>
const tab = ref<'inbox' | 'archived'>('inbox')
const archived = computed(() => tab.value === 'archived')

const { data, refresh, status } = await useFetch<Email[]>('/api/admin/emails', {
    dedupe: 'defer',
    query: computed(() => ({ archived: archived.value ? 'true' : undefined })),
})

const emailSlideover = useEmailDetailSlideover({
    props: { modal: false },
    destroyOnClose: false,
})

const openEmail = async (email: Email) => {
    // Optimistic read mark
    if (!email.isRead) {
        email.isRead = true
        $fetch(`/api/admin/emails/${email.id}`, {
            method: 'PATCH',
            body: { isRead: true },
        }).catch(() => {
            email.isRead = false
        })
    }
    emailSlideover.open({
        email,
        onArchive: (id) => {
            if (data.value) {
                data.value = data.value.filter((e) => e.id !== id)
            }
        },
    })
}

interface EmailGroup {
    label: string | null
    emails: Email[]
}

const groupedEmails = computed<EmailGroup[]>(() => {
    if (!data.value?.length) return []

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)

    // Week starts on Monday
    const weekDay = todayStart.getDay() // 0 = Sunday
    const daysFromMonday = weekDay === 0 ? 6 : weekDay - 1
    const weekStart = new Date(todayStart)
    weekStart.setDate(weekStart.getDate() - daysFromMonday)

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const buckets = new Map<string, Email[]>()

    for (const email of data.value) {
        const receivedAt = new Date(email.receivedAt)
        let key: string

        if (receivedAt >= todayStart) key = '__today__'
        else if (receivedAt >= yesterdayStart) key = '__yesterday__'
        else if (receivedAt >= weekStart) key = '__this_week__'
        else if (receivedAt >= monthStart) key = '__this_month__'
        else {
            const year = receivedAt.getFullYear()
            const month = receivedAt.getMonth()
            key = year === now.getFullYear() ? `month_${year}_${month}` : `year_${year}`
        }

        const bucket = buckets.get(key) ?? []
        bucket.push(email)
        buckets.set(key, bucket)
    }

    const result: EmailGroup[] = []

    const fixedKeys: [string, string | null][] = [
        ['__today__', null],
        ['__yesterday__', 'Yesterday'],
        ['__this_week__', 'This Week'],
        ['__this_month__', 'This Month'],
    ]

    for (const [key, label] of fixedKeys) {
        const emails = buckets.get(key)
        if (emails) {
            result.push({ label, emails })
            buckets.delete(key)
        }
    }

    // Sort remaining dynamic keys (month_ / year_) descending
    const dynamicKeys = [...buckets.keys()].sort((a, b) => {
        const score = (k: string) => {
            if (k.startsWith('month_')) {
                const parts = k.split('_')
                return Number(parts[1]) * 100 + Number(parts[2])
            }
            return Number(k.split('_')[1]) * 100 + 11
        }
        return score(b) - score(a)
    })

    for (const key of dynamicKeys) {
        const emails = buckets.get(key)!
        let label: string
        if (key.startsWith('month_')) {
            const parts = key.split('_')
            label = new Intl.DateTimeFormat('en', { month: 'long' }).format(
                new Date(Number(parts[1]), Number(parts[2]), 1),
            )
        } else {
            label = String(Number(key.split('_')[1]))
        }
        result.push({ label, emails })
    }

    return result
})

useSeo({
    title: 'Admin - Emails',
})
</script>

<template>
    <UDashboardPanel id="emails" :ui="{ body: 'gap-4 sm:gap-4 p-2 sm:p-2' }" class="max-w-[100qw]">
        <template #header>
            <UDashboardNavbar title="Emails">
                <template #trailing>
                    <UButton
                        loading-auto
                        icon="mingcute:refresh-2-line"
                        variant="ghost"
                        size="sm"
                        @click="refresh()"
                    />
                </template>

                <template #right>
                    <UButton icon="mingcute:send-fill" label="New Mail" color="neutral" />
                </template>
            </UDashboardNavbar>
        </template>

        <template #body>
            <UTabs
                v-model="tab"
                :items="[
                    { label: 'Inbox', value: 'inbox' },
                    { label: 'Archived', value: 'archived' },
                ]"
                color="neutral"
                :ui="{ list: 'bg-transparent p-0 w-fit', indicator: 'inset-0' }"
                class="mx-1 mt-1 w-fit"
            />

            <UEmpty
                v-if="status !== 'pending' && !data?.length"
                icon="mingcute:mail-fill"
                title="No emails found"
            />

            <div v-else class="flex flex-col gap-6">
                <template v-for="group in groupedEmails" :key="group.label ?? '__today__'">
                    <div class="flex flex-col gap-1">
                        <template v-if="group.label">
                            <span class="text-toned mx-3 mb-2 text-sm leading-none font-medium">
                                {{ group.label }}
                            </span>
                            <USeparator />
                        </template>

                        <div class="flex flex-col">
                            <UButton
                                v-for="email in group.emails"
                                :key="email.id"
                                variant="ghost"
                                class="flex items-center gap-2 p-3 text-xs leading-none"
                                @click="openEmail(email)"
                            >
                                <span
                                    class="w-48 truncate text-left"
                                    :class="{ 'text-muted': email.isRead }"
                                >
                                    {{
                                        email.fromName
                                            ? `${email.fromName} <${email.fromAddress}>`
                                            : email.fromAddress
                                    }}
                                </span>

                                <p :class="cn('text-toned truncate', email.isRead && 'text-muted')">
                                    {{ email.subject ?? '(no subject)' }}

                                    <span v-if="email.snippet" class="text-dimmed">
                                        {{ email.snippet }}
                                    </span>
                                </p>

                                <NuxtTime
                                    :datetime="email.receivedAt"
                                    relative
                                    locale="en"
                                    class="w-32 shrink-0 text-right leading-none"
                                    :class="{ 'text-muted': email.isRead }"
                                />
                            </UButton>
                        </div>
                    </div>
                </template>
            </div>
        </template>
    </UDashboardPanel>
</template>
