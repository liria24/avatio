<script lang="ts" setup>
import type { InboundEmail } from '@unosend/node'

const { locale } = useI18n()

const { data, refresh } = await useFetch<InboundEmail[]>('/api/admin/emails', {
    dedupe: 'defer',
    transform: (data) =>
        data.map((email) => ({
            ...email,
            from_name: email.from_name ? `${email.from_name} <${email.from}>` : email.from,
        })),
})
</script>

<template>
    <UDashboardPanel id="emails">
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
            <UEmpty v-if="!data?.length" icon="mingcute:mail-fill" title="No emails found" />

            <UPageList v-else class="gap-4">
                <UModal v-for="email in data" :key="email.id" :ui="{ content: 'p-6' }">
                    <UPageCard class="hover:cursor-pointer">
                        <div class="text-muted flex items-center gap-2 text-xs">
                            <span class="min-w-0 grow truncate font-mono leading-none">
                                {{ email.from_name }}
                            </span>
                            <NuxtTime
                                :datetime="email.received_at"
                                relative
                                :locale
                                class="shrink-0 leading-none"
                            />
                        </div>

                        <p class="text-toned truncate text-sm">{{ email.subject }}</p>
                    </UPageCard>

                    <template #content>
                        <div class="flex flex-col gap-2">
                            <div class="text-muted flex items-center gap-1 text-xs font-medium">
                                To: {{ email.to }}
                            </div>

                            <div
                                v-if="email.attachment_count"
                                class="text-muted flex items-center gap-1 text-xs"
                            >
                                <Icon name="lucide:paperclip" size="12" />
                                <span>
                                    {{ email.attachment_count }}
                                </span>
                            </div>

                            <div v-if="email.html" class="text-xs" v-html="email.html" />

                            <p v-else-if="email.text" class="text-xs whitespace-pre-wrap">
                                {{ email.text }}
                            </p>
                        </div>
                    </template>
                </UModal>
            </UPageList>
        </template>
    </UDashboardPanel>
</template>
