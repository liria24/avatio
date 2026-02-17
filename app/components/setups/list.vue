<script lang="ts" setup>
interface Props {
    type?: 'latest' | 'owned' | 'bookmarked'
    username?: string
}
const { type, username } = defineProps<Props>()

const { session } = useAuth()
const { isMobile } = useDevice()

// Props Mode: typeプロップがある場合、内部でuseSetupsListを使用
// Model Mode: typeプロップがない場合、外部からsetups/loadingモデルを受け取る
const isPropsMode = computed(() => !!type)

const modelSetups = defineModel<Serialized<Setup>[]>('setups', {
    default: [],
})
const modelLoading = defineModel<boolean>('loading', {
    default: false,
})

// Props Mode用のリアクティブな参照
const propsResult = ref<ReturnType<typeof useSetupsList> | null>(null)

// Props Modeの初期化関数
const initializePropsMode = async () => {
    if (!type) return

    // ownedタイプでusernameが未指定の場合、自動的にセッションから取得
    const effectiveUsername =
        type === 'owned' && !username ? (session.value?.user.username ?? undefined) : username

    const result = useSetupsList(type, {
        username: effectiveUsername,
        immediate: false,
    })

    propsResult.value = result

    await result.initialize()
}

// 初回実行
if (type) await initializePropsMode()

// typeまたはusernameが変更されたら再初期化
watch(
    () => [type, username] as const,
    async () => {
        if (type) await initializePropsMode()
    },
)

const setups = computed<Serialized<Setup>[]>(() => {
    if (isPropsMode.value && propsResult.value) return propsResult.value.setups

    return modelSetups.value
})
const loading = computed<boolean>(() => {
    if (isPropsMode.value && propsResult.value) return propsResult.value.status === 'pending'

    return modelLoading.value
})
</script>

<template>
    <div class="flex w-full flex-col gap-3 self-center">
        <Icon
            v-if="loading"
            name="svg-spinners:ring-resize"
            size="24"
            class="mt-4 self-center bg-zinc-500"
        />

        <p v-else-if="!setups?.length" class="text-muted mt-4 self-center text-center text-sm">
            {{ $t('search.listEmpty') }}
        </p>

        <MasonryWall
            v-else
            :items="setups"
            :column-width="240"
            :gap="6"
            :min-columns="2"
            :max-columns="3"
            :ssr-columns="isMobile ? 2 : 3"
        >
            <template #default="{ item, index }">
                <SetupsLink
                    :aria-label="item.name"
                    :image-size="{ width: 16, height: 9 }"
                    :setup="item"
                    :style="`animation-delay: ${50 * index}ms`"
                    class="fade-in"
                />
            </template>
        </MasonryWall>

        <!-- Props Modeの場合のみページネーションボタンを表示 -->
        <UButton
            v-if="isPropsMode && propsResult?.pagination?.hasNext"
            :loading="propsResult?.status === 'pending'"
            :label="$t('more')"
            variant="soft"
            size="lg"
            class="w-fit self-center"
            @click="propsResult?.loadMore()"
        />
    </div>
</template>

<style scoped>
.fade-in {
    opacity: 0;
    animation: fadeIn 400ms ease-in-out forwards;
}

@keyframes fadeIn {
    0% {
        opacity: 0;
        transform: translateY(10px);
        filter: blur(4px);
    }
    100% {
        opacity: 1;
        transform: translateY(0);
        filter: blur(0);
    }
}
</style>
