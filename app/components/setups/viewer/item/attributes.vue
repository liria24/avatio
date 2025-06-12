<script lang="ts" setup>
interface Props {
    note: string | null
    unsupported: boolean
    shapekeys: { name: string; value: number }[]
}

const props = defineProps<Props>()

const copy = (key: { name: string; value: number }) => {
    writeClipboard(key.value.toString())
    useToast().add(`${key.name} の値をコピーしました`)
}
</script>

<template>
    <div
        :data-noted="props.note?.length ? true : false"
        class="flex w-full flex-col gap-1.5 rounded-lg p-2 ring-1 ring-zinc-300 ring-inset empty:hidden data-[noted=false]:p-0 data-[noted=false]:ring-0 dark:ring-zinc-700"
    >
        <div v-if="props.note?.length" class="flex items-start gap-2 px-1">
            <Icon
                name="lucide:pen-line"
                :size="15"
                class="mt-[0.2rem] shrink-0 text-zinc-400 dark:text-zinc-400"
            />
            <p
                class="text-left text-xs/relaxed [overflow-wrap:anywhere] break-keep whitespace-break-spaces text-zinc-900 dark:text-zinc-100"
            >
                {{ props.note }}
            </p>
        </div>
        <div class="flex flex-wrap items-center justify-end gap-3 empty:hidden">
            <div
                v-if="props.unsupported"
                class="flex items-center gap-2 px-3 py-2"
            >
                <Icon
                    name="lucide:user-round-x"
                    :size="15"
                    class="shrink-0 text-zinc-400 dark:text-zinc-400"
                />
                <p
                    class="text-left text-xs leading-none font-medium text-zinc-500 dark:text-zinc-400"
                >
                    アバター非対応
                </p>
            </div>
            <Popup side="right">
                <template #trigger>
                    <Button
                        v-if="props.shapekeys?.length"
                        class="rounded-lg bg-zinc-100 px-3 py-2 dark:bg-zinc-800"
                    >
                        <Icon
                            name="lucide:shapes"
                            :size="15"
                            class="shrink-0 text-zinc-400 dark:text-zinc-400"
                        />
                        <p
                            class="pb-px text-xs/relaxed leading-none font-medium whitespace-nowrap text-zinc-600 dark:text-zinc-400"
                        >
                            {{ props.shapekeys.length }} 個のシェイプキー
                        </p>
                    </Button>
                </template>

                <template #content>
                    <div class="flex min-w-48 flex-col gap-3 text-sm">
                        <div
                            class="flex w-full items-center justify-between gap-2"
                        >
                            <UiTitle
                                label="シェイプキー"
                                icon="lucide:shapes"
                            />
                            <!-- <Button
                                tooltip="Unityコンポーネントとしてコピー"
                                class="p-2"
                            >
                                <Icon
                                    name="simple-icons:unity"
                                    :size="18"
                                    class="shrink-0 text-zinc-800 dark:text-zinc-200"
                                />
                            </Button> -->
                        </div>
                        <div
                            class="flex flex-col gap-3 rounded-lg p-3 ring-1 ring-zinc-300 dark:ring-zinc-700"
                        >
                            <div
                                v-for="(key, index) in props.shapekeys"
                                :key="'shapekey-' + index"
                                class="flex items-center justify-between gap-3"
                            >
                                <p
                                    class="leading-none text-zinc-700 dark:text-zinc-300"
                                >
                                    {{ key.name }}
                                </p>
                                <button
                                    type="button"
                                    :class="[
                                        'cursor-pointer rounded-md px-2 py-1',
                                        'font-mono leading-none text-zinc-800 dark:text-zinc-200',
                                        'bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 hover:dark:bg-zinc-700',
                                        'transition-colors duration-150 ease-in-out',
                                    ]"
                                    @click="copy(key)"
                                >
                                    {{
                                        key.value.toLocaleString(undefined, {
                                            minimumFractionDigits: 1,
                                            maximumFractionDigits: 4,
                                        })
                                    }}
                                </button>
                            </div>
                        </div>
                    </div>
                </template>
            </Popup>
        </div>
    </div>
</template>
