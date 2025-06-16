<script lang="ts" setup>
const vis = defineModel<boolean>({ default: false })
const client = useSupabaseClient()
const toast = useToast()

const feedback = ref<string>('')

const Submit = async () => {
    if (!feedback.value.length)
        return toast.add({
            title: 'フィードバックを入力してください',
            color: 'warning',
        })

    const { error } = await client
        .from('feedback')
        .insert({ contents: feedback.value })

    if (error)
        return toast.add({
            title: 'フィードバックの送信に失敗',
            color: 'error',
        })

    toast.add({ title: 'フィードバックを送信しました' })
    vis.value = false
}
</script>

<template>
    <Modal v-model="vis">
        <template #header>
            <div class="flex items-center justify-between gap-2">
                <DialogTitle>
                    <UiTitle label="フィードバック" icon="lucide:lightbulb" />
                </DialogTitle>

                <HovercardFeedback>
                    <Icon
                        name="lucide:info"
                        class="size-4 shrink-0 text-zinc-400 dark:text-zinc-300"
                    />
                </HovercardFeedback>
            </div>
        </template>

        <div class="flex flex-col gap-5">
            <div class="relative">
                <UiTextarea
                    v-model="feedback"
                    autoresize
                    placeholder="なにかアイデアがあればお送りください！"
                />
                <Icon
                    name="simple-icons:markdown"
                    class="absolute right-2 bottom-1 size-6 shrink-0 bg-zinc-500 select-none"
                />
            </div>
        </div>

        <template #footer>
            <div class="flex items-center justify-between gap-1.5">
                <Button
                    label="キャンセル"
                    variant="flat"
                    @click="vis = false"
                />
                <Button label="送信" @click="Submit" />
            </div>
        </template>
    </Modal>
</template>
