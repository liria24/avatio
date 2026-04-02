<script lang="ts" setup>
interface Props {
    email: Email
    onArchive?: (id: number) => void
}

const props = defineProps<Props>()
const emit = defineEmits(['close'])

const { data: body, status } = useLazyFetch(`/api/admin/emails/${props.email.id}/body`)

const archiving = ref(false)

const archive = async () => {
    archiving.value = true
    try {
        await $fetch(`/api/admin/emails/${props.email.id}`, {
            method: 'PATCH',
            body: { isArchived: !props.email.isArchived },
        })
        props.onArchive?.(props.email.id)
        emit('close')
    } finally {
        archiving.value = false
    }
}
</script>

<template>
    <USlideover :ui="{ content: 'p-6' }">
        <template #header>
            <div class="flex min-w-0 flex-1 flex-col gap-1">
                <p class="truncate font-semibold">{{ email.subject ?? '(no subject)' }}</p>

                <div class="text-muted flex flex-col gap-2 text-xs">
                    <span class="min-w-0 grow truncate font-mono">
                        {{
                            email.fromName
                                ? `${email.fromName} <${email.fromAddress}>`
                                : email.fromAddress
                        }}
                    </span>

                    <div class="text-muted text-xs">
                        <span class="font-medium">To:</span> {{ email.toAddress }}
                    </div>

                    <NuxtTime :datetime="email.receivedAt" locale="jp" class="shrink-0" />
                </div>
            </div>

            <UButton
                :loading="archiving"
                :icon="email.isArchived ? 'mingcute:inbox-2-line' : 'mingcute:archive-line'"
                :aria-label="email.isArchived ? 'Unarchive' : 'Archive'"
                variant="ghost"
                size="sm"
                @click="archive()"
            />
        </template>

        <template #body>
            <div class="flex flex-col gap-3">
                <template v-if="status === 'pending'">
                    <USkeleton class="h-4 w-3/4" />
                    <USkeleton class="h-4 w-full" />
                    <USkeleton class="h-4 w-2/3" />
                    <USkeleton class="h-4 w-full" />
                    <USkeleton class="h-4 w-1/2" />
                </template>

                <template v-else-if="body">
                    <div v-if="body.html" class="text-sm" v-html="body.html" />
                    <p v-else-if="body.text" class="text-sm whitespace-pre-wrap">{{ body.text }}</p>
                    <p v-else class="text-muted text-sm">(no content)</p>

                    <div
                        v-if="body.attachments?.length"
                        class="text-muted flex items-center gap-1 text-xs"
                    >
                        <Icon name="lucide:paperclip" size="12" />
                        <span>
                            {{ body.attachments.length }} attachment{{
                                body.attachments.length > 1 ? 's' : ''
                            }}
                        </span>
                    </div>
                </template>
            </div>
        </template>
    </USlideover>
</template>
