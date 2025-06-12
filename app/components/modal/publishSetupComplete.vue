<script lang="ts" setup>
import confetti from 'canvas-confetti'

interface Props {
    id: number | null
}
const props = defineProps<Props>()
const vis = defineModel<boolean>({ default: false })
const emit = defineEmits(['continue'])

const link = computed(() => `https://avatio.me/setup/${props.id}`)
const setup = ref<SetupClient | null>(null)
const copied = ref(false)
const loading = ref(false)

const fetchSetup = async (setupId: number) => {
    if (!setupId) return

    loading.value = true

    try {
        const response = await $fetch(`/api/setup/${setupId}`)

        if (!response) return

        setup.value = response

        confetti({
            particleCount: 80,
            spread: 100,
            origin: { x: 0, y: 0.7 },
        })
        confetti({
            particleCount: 80,
            spread: 100,
            origin: { x: 1, y: 0.7 },
        })
    } catch (e) {
        console.error('セットアップ取得エラー:', e)
    } finally {
        loading.value = false
    }
}

const copy = (link: string) => {
    writeClipboard(link)
    copied.value = true
}

const onContinue = () => {
    setup.value = null
    copied.value = false
    emit('continue')
    vis.value = false
}

watch(
    () => props.id,
    async (newId) => {
        if (!newId) return
        await fetchSetup(newId)
    }
)
</script>

<template>
    <Modal
        v-model="vis"
        @update:open="
            (() => {
                if (!$event) {
                    setup = null
                    copied = false
                    emit('continue')
                    vis = false
                }
            })()
        "
    >
        <template #header>
            <DialogTitle
                class="self-center font-medium text-black dark:text-white"
            >
                投稿が完了しました！
            </DialogTitle>
        </template>

        <!-- セットアップ詳細表示 -->
        <div v-if="setup" class="flex flex-col items-center gap-1">
            <div
                class="flex w-full flex-col items-center gap-2 rounded-lg p-3 ring-1 ring-zinc-600"
            >
                <NuxtImg
                    v-if="setup.images.length"
                    :src="
                        getImage(setup.images[0]?.name, {
                            prefix: 'setup',
                        })
                    "
                    class="max-h-64 rounded-lg"
                />
                <p class="text-sm font-bold text-zinc-300">{{ setup.name }}</p>
            </div>

            <div class="mt-3 flex items-center gap-1">
                <NuxtLink
                    :to="link"
                    target="_blank"
                    class="text-sm leading-0 text-zinc-400"
                >
                    {{ link }}
                </NuxtLink>
                <Button variant="flat" class="ml-2 p-2" @click="copy(link)">
                    <Icon v-if="!copied" name="lucide:copy" size="16" />
                    <Icon v-else name="lucide:check" size="16" />
                </Button>
                <PopupShare
                    :setup-name="setup.name"
                    :setup-description="setup.description || ''"
                    :setup-author="setup.author.name"
                    :copy-url-button="false"
                >
                    <Button variant="flat" class="p-2">
                        <Icon name="lucide:share-2" size="16" />
                    </Button>
                </PopupShare>
            </div>

            <Button
                variant="flat"
                class="w-full"
                @click="navigateTo(`/setup/${id}`)"
            >
                <Icon name="lucide:arrow-right" size="18" />
                <span>投稿したセットアップを見る</span>
            </Button>
        </div>

        <template #footer>
            <Button @click="onContinue">
                <Icon name="lucide:plus" size="18" />
                <span>続けて投稿</span>
            </Button>
        </template>
    </Modal>
</template>
