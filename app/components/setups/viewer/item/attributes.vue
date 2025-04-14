<script lang="ts" setup>
interface Props {
    note: string | null;
    unsupported: boolean;
    shapekeys: { name: string; value: number }[];
}

const { note, unsupported, shapekeys } = defineProps<Props>();
</script>

<template>
    <div
        :data-noted="note?.length ? true : false"
        class="empty:hidden w-full p-2 data-[noted=false]:p-0 flex flex-col gap-1.5 rounded-lg ring-inset ring-1 data-[noted=false]:ring-0 ring-zinc-300 dark:ring-zinc-700"
    >
        <div v-if="note?.length" class="px-1 gap-2 flex items-start">
            <Icon
                name="lucide:pen-line"
                :size="15"
                class="shrink-0 mt-[0.2rem] text-zinc-400 dark:text-zinc-400"
            />
            <p
                class="text-xs/relaxed text-left break-keep whitespace-break-spaces [overflow-wrap:anywhere] text-zinc-900 dark:text-zinc-100"
            >
                {{ note }}
            </p>
        </div>
        <div class="empty:hidden flex flex-wrap gap-3 items-center justify-end">
            <div v-if="unsupported" class="px-3 py-2 gap-2 flex items-center">
                <Icon
                    name="lucide:user-round-x"
                    :size="15"
                    class="shrink-0 text-zinc-400 dark:text-zinc-400"
                />
                <p
                    class="font-medium text-xs leading-none text-left text-zinc-500 dark:text-zinc-400"
                >
                    アバター非対応
                </p>
            </div>
            <Popup side="right">
                <template #trigger>
                    <Button
                        v-if="shapekeys?.length"
                        class="px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800"
                    >
                        <Icon
                            name="lucide:shapes"
                            :size="15"
                            class="shrink-0 text-zinc-400 dark:text-zinc-400"
                        />
                        <p
                            class="pb-px font-medium text-xs/relaxed leading-none whitespace-nowrap text-zinc-600 dark:text-zinc-400"
                        >
                            {{ shapekeys.length }} 個のシェイプキー
                        </p>
                    </Button>
                </template>

                <template #content>
                    <div class="flex flex-col gap-3 text-sm min-w-48">
                        <div
                            class="w-full flex items-center justify-between gap-2"
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
                            class="p-3 rounded-lg flex flex-col gap-3 ring-1 ring-zinc-300 dark:ring-zinc-700"
                        >
                            <div
                                v-for="(key, index) in shapekeys"
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
                                        'px-2 py-1 rounded-md cursor-pointer',
                                        'font-mono leading-none text-zinc-800 dark:text-zinc-200',
                                        'bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 hover:dark:bg-zinc-700',
                                        'transition-colors duration-150 ease-in-out',
                                    ]"
                                    @click="
                                        useWriteClipboard(key.value.toString());
                                        useToast().add(
                                            `${key.name} の値をコピーしました`
                                        );
                                    "
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
