<script lang="ts" setup>
import { z } from 'zod'

interface Props {
    email: Email
}

const props = defineProps<Props>()
const emit = defineEmits(['close'])
const toast = useToast()

const schema = z.object({
    text: z.string().trim().min(1, 'Message is required').max(10000, 'Message is too long'),
})

const state = reactive({
    text: '',
})

const sending = ref(false)

const subject = computed(() => {
    const value = props.email.subject || '(no subject)'
    return value.toLowerCase().startsWith('re:') ? value : `Re: ${value}`
})

const recipient = computed(() =>
    props.email.fromName
        ? `${props.email.fromName} <${props.email.fromAddress}>`
        : props.email.fromAddress,
)

const send = async () => {
    sending.value = true
    try {
        await $fetch(`/api/admin/emails/${props.email.id}/reply`, {
            method: 'POST',
            body: { text: state.text },
        })
        toast.add({
            title: 'Reply sent',
            color: 'success',
        })
        emit('close')
    } catch {
        toast.add({
            title: 'Failed to send reply',
            color: 'error',
        })
    } finally {
        sending.value = false
    }
}
</script>

<template>
    <UModal title="Reply" :ui="{ footer: 'justify-end' }">
        <template #body>
            <UForm :state :schema class="flex flex-col gap-4" @submit="send">
                <div class="text-muted flex flex-col gap-1 text-sm">
                    <p class="truncate">
                        <span class="font-medium">To:</span>
                        {{ recipient }}
                    </p>
                    <p class="truncate">
                        <span class="font-medium">Subject:</span>
                        {{ subject }}
                    </p>
                </div>

                <UFormField name="text" label="Message" required>
                    <UTextarea
                        v-model="state.text"
                        autoresize
                        :rows="8"
                        :maxrows="16"
                        class="w-full"
                        placeholder="Write a plain text reply..."
                    />
                </UFormField>
            </UForm>
        </template>

        <template #footer>
            <UButton
                label="Cancel"
                color="neutral"
                variant="outline"
                :disabled="sending"
                @click="emit('close')"
            />
            <UButton label="Send" icon="mingcute:send-fill" :loading="sending" @click="send()" />
        </template>
    </UModal>
</template>
