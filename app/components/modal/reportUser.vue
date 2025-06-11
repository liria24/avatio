<script lang="ts" setup>
const vis = defineModel<boolean>({ default: false })

const props = defineProps<{ id: string }>()

const choices = ref({
    spam: {
        label: 'スパム',
        description: 'スパムの投稿を含む',
        value: false,
    },
    hate: {
        label: '悪意のあるユーザー',
        description: 'ヘイト、差別、脅迫など悪意のある内容を投稿している。',
        value: false,
    },
    infringement: {
        label: '権利侵害',
        description: '他者の権利を侵している、または権利侵害を助長している。',
        value: false,
    },
    other: {
        label: 'その他',
        description: 'その他の理由で報告',
        value: false,
    },
})
const additional = ref<string>('')

const Submit = async () => {
    const client = useSupabaseClient()

    if (
        !choices.value.spam.value &&
        !choices.value.hate.value &&
        !choices.value.infringement.value &&
        !choices.value.other.value
    )
        return useToast().add('報告の理由を選択してください')

    if (choices.value.other && !additional.value.length)
        return useToast().add(
            '"その他"を選択した場合は、理由を入力してください'
        )

    const { error } = await client.from('report_user').insert({
        reportee: props.id,
        spam: choices.value.spam.value,
        hate: choices.value.hate.value,
        infringement: choices.value.infringement.value,
        other: choices.value.other.value,
        additional: additional.value,
    })
    if (error) {
        console.error(error)
        return useToast().add(
            '報告の送信に失敗しました',
            'もう一度お試しください'
        )
    }

    useToast().add('報告が送信されました', 'ご協力ありがとうございます')
    vis.value = false
}
</script>

<template>
    <Modal v-model="vis">
        <template #header>
            <div
                class="flex w-full flex-row items-center justify-center gap-2 px-10"
            >
                <Icon
                    name="lucide:flag"
                    size="20"
                    class="text-zinc-600 dark:text-zinc-400"
                />
                <span class="font-medium text-black dark:text-white">
                    ユーザーの報告
                </span>
            </div>
        </template>

        <div class="flex w-full flex-col items-center gap-2 overflow-y-auto">
            <Toggle
                v-for="(choice, index) in choices"
                :key="'choice-' + index"
                class="group flex w-full flex-col gap-1.5 rounded-xl border border-zinc-400 p-5 data-[state=on]:bg-zinc-300 dark:border-zinc-600 data-[state=on]:dark:bg-zinc-700"
                @click="choice.value = !choice.value"
            >
                <div class="flex items-center gap-2.5">
                    <div
                        class="flex rounded-md p-0.5 ring-1 ring-zinc-600 group-data-[state=on]:bg-zinc-600 dark:ring-zinc-600 group-data-[state=on]:dark:bg-zinc-300"
                    >
                        <Icon
                            name="lucide:check"
                            size="16"
                            class="text-zinc-100 group-data-[state=off]:bg-transparent dark:text-zinc-900"
                        />
                    </div>
                    <span
                        class="pb-px leading-none font-medium text-zinc-900 dark:text-zinc-100"
                    >
                        {{ choice.label }}
                    </span>
                </div>

                <span
                    class="text-left text-sm whitespace-pre-line text-zinc-900 dark:text-zinc-100"
                >
                    {{ choice.description }}
                </span>
            </Toggle>
            <p
                class="mt-3 w-full text-left font-medium text-zinc-600 dark:text-zinc-300"
            >
                報告の詳細や背景情報
            </p>
            <UiTextarea
                v-model="additional"
                autoresize
                placeholder="その他の理由を入力"
                class="w-full"
            />
        </div>

        <template #footer>
            <div class="flex items-center justify-between gap-1.5">
                <Button
                    label="キャンセル"
                    variant="flat"
                    @click="vis = false"
                />
                <Button label="報告" @click="Submit" />
            </div>
        </template>
    </Modal>
</template>
