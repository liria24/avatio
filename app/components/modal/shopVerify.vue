<script lang="ts" setup>
const emit = defineEmits(['refresh'])
const vis = defineModel<boolean>({ default: false })
const shops = defineModel<
    {
        id: string
        name: string
        thumbnail: string
        verified_at: string
    }[]
>('shops', { default: [] })

const codeGenerating = ref(false)
const verifying = ref(false)
const verified = ref(false)
const code = ref<string>('')
const copied = ref(false)
const shopUrl = ref<string>('')

const check = () => {
    try {
        if (
            !shopUrl.value?.length ||
            !code.value?.length ||
            codeGenerating.value
        )
            return false

        const url = new URL(shopUrl.value)

        if (url.hostname.endsWith('.booth.pm')) return true
        else return false
    } catch {
        return false
    }
}

const verify = async () => {
    if (!check()) return

    const subDomain = boothSubDomain(shopUrl.value)
    if (!subDomain) return
    if (shops.value.find((shop) => shop.id === subDomain)) {
        useToast().add('このショップは既に認証済みです')
        return
    }

    try {
        verifying.value = true

        const { verified: v } = await $fetch('/api/shop-verification/verify', {
            method: 'POST',
            body: { url: shopUrl.value },
        })

        if (v) {
            emit('refresh')
            verified.value = true
            useToast().add('認証に成功しました')
        } else {
            useToast().add('認証に失敗しました')
        }
    } catch (e) {
        useToast().add('認証に失敗しました')
    } finally {
        verifying.value = false
    }
}

const generateCode = async () => {
    codeGenerating.value = true

    code.value =
        (
            await $fetch('/api/shop-verification/generate-code', {
                method: 'POST',
            })
        ).code || ''

    codeGenerating.value = false
}

watchEffect(() => {
    if (vis.value) {
        code.value = ''
        shopUrl.value = ''
        copied.value = false
        verified.value = false
        verifying.value = false
        codeGenerating.value = false
    }
})
</script>

<template>
    <Modal v-model="vis">
        <template #header>
            <DialogTitle>
                <UiTitle label="オーナー認証" icon="lucide:store" />
            </DialogTitle>
        </template>

        <template v-if="verifying">
            <Icon
                name="svg-spinners:ring-resize"
                size="24"
                class="self-center py-12 text-zinc-600 dark:text-zinc-400"
            />
        </template>

        <template v-else-if="!verified">
            <div class="flex flex-col gap-5">
                <div class="flex flex-col gap-3">
                    <p class="text-sm">
                        1. あなたの所有するショップのURLを入力してください。
                    </p>

                    <UiTextinput
                        v-model="shopUrl"
                        placeholder="https://***.booth.pm"
                    />
                </div>

                <div class="flex flex-col gap-3">
                    <p class="text-sm">
                        2. ショップの紹介文に以下のコードを追記してください。
                    </p>

                    <Button
                        v-if="!code && !codeGenerating"
                        @click="generateCode"
                    >
                        <Icon name="lucide:code" size="16" />
                        コードを生成
                    </Button>
                    <Icon
                        v-else-if="codeGenerating"
                        name="svg-spinners:ring-resize"
                        size="24"
                        class="self-center text-zinc-600 dark:text-zinc-400"
                    />
                    <div v-else class="flex items-center gap-2 px-2">
                        <span
                            class="text-sm break-all text-zinc-600 dark:text-zinc-400"
                        >
                            {{ code }}
                        </span>

                        <Button
                            variant="flat"
                            tooltip="コードをコピー"
                            class="ml-2 p-2"
                            @click="
                                writeClipboard(code)
                                copied = true
                            "
                        >
                            <Icon v-if="!copied" name="lucide:copy" size="16" />
                            <Icon v-else name="lucide:check" size="16" />
                        </Button>
                    </div>
                </div>
            </div>

            <div
                class="flex items-center gap-2 rounded-md p-3 ring-1 ring-zinc-300 dark:ring-zinc-700"
            >
                <Icon
                    name="lucide:info"
                    size="16"
                    class="text-zinc-700 dark:text-zinc-300"
                />
                <p class="text-sm text-zinc-700 dark:text-zinc-300">
                    コードの有効期限は10分です。
                </p>
            </div>
        </template>

        <template v-else>
            <div class="flex w-full flex-col items-center gap-5">
                <Icon
                    name="lucide:circle-check"
                    size="64"
                    class="text-zinc-700 dark:text-zinc-300"
                />

                <div
                    class="flex flex-col gap-2 rounded-md p-3 ring-1 ring-red-400 dark:ring-red-400/70"
                >
                    <p class="text-sm text-zinc-700 dark:text-zinc-300">
                        紹介文に記載したコードを忘れずに削除してください！
                    </p>
                </div>
            </div>
        </template>

        <template #footer>
            <div
                v-if="!verified"
                class="flex items-center justify-between gap-1.5"
            >
                <Button
                    label="キャンセル"
                    variant="flat"
                    @click="vis = false"
                />
                <Button :disabled="!check()" label="認証" @click="verify" />
            </div>

            <div v-else class="flex items-center justify-end gap-1.5">
                <Button label="閉じる" variant="flat" @click="vis = false" />
            </div>
        </template>
    </Modal>
</template>
