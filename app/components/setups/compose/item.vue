<script lang="ts" setup>
const unsupported = defineModel<boolean>('unsupported', {
    default: false,
})
const shapekeys = defineModel<SetupItemShapekey[]>('shapekeys', {
    default: [],
})
const note = defineModel<string | null | undefined>('note', {
    default: '',
})

interface Props {
    item: SetupItem
}
const props = defineProps<Props>()

const emit = defineEmits(['change-category', 'remove-item', 'shapekey-add', 'shapekey-remove'])

const { itemCategory } = useAppConfig()

const inputShapekeyName = ref('')
const inputShapekeyValue = ref(0)
</script>

<template>
    <div class="ring-accented flex items-start gap-2 rounded-md p-2 ring-1">
        <div
            class="draggable hover:bg-elevated grid h-full cursor-move rounded-md px-1 py-2 transition-colors"
        >
            <Icon name="mingcute:dots-fill" size="18" class="text-muted shrink-0 self-center" />
        </div>

        <div class="flex grow flex-col gap-2">
            <div class="flex items-start gap-1">
                <NuxtLink
                    v-if="props.item.image"
                    :to="computeItemUrl(props.item.id, props.item.platform)"
                    target="_blank"
                    class="shrink-0"
                >
                    <NuxtImg
                        v-slot="{ isLoaded, src, imgAttrs }"
                        :src="props.item.image || undefined"
                        :width="88"
                        :height="88"
                        format="avif"
                        custom
                    >
                        <img
                            v-if="isLoaded"
                            v-bind="imgAttrs"
                            :src
                            :alt="props.item.name"
                            class="aspect-square size-18 shrink-0 rounded-lg object-cover"
                        />
                        <USkeleton v-else class="aspect-square size-18 shrink-0 rounded-lg" />
                    </NuxtImg>
                </NuxtLink>

                <div class="flex grow flex-col gap-2 self-center pl-2">
                    <div class="flex items-center gap-2">
                        <UTooltip
                            v-if="props.item.platform === 'booth'"
                            text="BOOTH"
                            :delay-duration="50"
                        >
                            <Icon name="avatio:booth" size="16" class="text-muted shrink-0" />
                        </UTooltip>

                        <UTooltip
                            v-else-if="props.item.platform === 'github'"
                            text="GitHub"
                            :delay-duration="50"
                        >
                            <Icon
                                name="mingcute:github-fill"
                                size="16"
                                class="text-muted shrink-0"
                            />
                        </UTooltip>

                        <NuxtLink
                            :to="computeItemUrl(props.item.id, props.item.platform)"
                            target="_blank"
                            class="text-toned line-clamp-2 py-1 font-mono text-sm tracking-wider"
                        >
                            {{ props.item.name }}
                        </NuxtLink>
                    </div>
                    <div class="flex items-center gap-2">
                        <UPopover
                            v-if="
                                ['avatar', 'hair', 'clothing', 'accessory'].includes(
                                    props.item.category
                                )
                            "
                        >
                            <UButton
                                :label="`シェイプキー: ${shapekeys?.length || 0}`"
                                variant="subtle"
                                size="sm"
                            />

                            <template #content>
                                <div class="flex flex-col items-center gap-2 p-2">
                                    <p v-if="!shapekeys?.length" class="text-muted p-3 text-sm">
                                        シェイプキーがありません
                                    </p>
                                    <template v-else>
                                        <div
                                            v-for="(shapekey, index) in shapekeys"
                                            :key="`shapekey-${index}`"
                                            class="flex w-full items-center gap-3"
                                        >
                                            <span class="text-muted grow text-right text-sm">
                                                {{ shapekey.name }}
                                            </span>
                                            <span class="text-toned text-sm font-semibold">
                                                {{ shapekey.value }}
                                            </span>
                                            <UButton
                                                icon="mingcute:close-line"
                                                variant="ghost"
                                                size="sm"
                                                @click="
                                                    emit('shapekey-remove', {
                                                        category: props.item.category,
                                                        id: props.item.id,
                                                        index: index,
                                                    })
                                                "
                                            />
                                        </div>
                                    </template>
                                    <div class="flex items-center gap-1">
                                        <UInput
                                            v-model="inputShapekeyName"
                                            placeholder="シェイプキー名称"
                                            size="sm"
                                            class="max-w-48"
                                        />
                                        <UInputNumber
                                            v-model="inputShapekeyValue"
                                            :step="0.001"
                                            orientation="vertical"
                                            size="sm"
                                            class="max-w-32"
                                        />
                                        <UButton
                                            icon="mingcute:add-line"
                                            variant="soft"
                                            size="sm"
                                            @click="
                                                () => {
                                                    emit('shapekey-add', {
                                                        category: props.item.category,
                                                        id: props.item.id,
                                                        name: inputShapekeyName,
                                                        value: inputShapekeyValue,
                                                    })
                                                    inputShapekeyName = ''
                                                    inputShapekeyValue = 0
                                                }
                                            "
                                        />
                                    </div>
                                </div>
                            </template>
                        </UPopover>

                        <UCheckbox
                            v-if="props.item.category !== 'avatar'"
                            v-model="unsupported"
                            label="ベースアバターに非対応"
                            size="sm"
                            :ui="{ label: 'text-muted' }"
                        />
                    </div>
                </div>

                <UDropdownMenu
                    :items="
                        Object.entries(itemCategory).map(([key, value]) => ({
                            label: value.label,
                            icon: value.icon,
                            value: key,
                            onSelect: () => emit('change-category', key),
                        }))
                    "
                    :content="{
                        align: 'center',
                        side: 'bottom',
                        sideOffset: 8,
                    }"
                    :ui="{ content: 'w-40' }"
                >
                    <UButton
                        :icon="itemCategory[props.item.category]?.icon || 'mingcute:box-3-fill'"
                        variant="ghost"
                        size="sm"
                    />
                </UDropdownMenu>

                <UButton
                    icon="mingcute:close-line"
                    variant="ghost"
                    size="sm"
                    @click="emit('remove-item')"
                />
            </div>

            <UTextarea
                v-model="note"
                placeholder="ノートの追加"
                autoresize
                size="sm"
                :rows="1"
                variant="soft"
                class="w-full"
            />
        </div>
    </div>
</template>
