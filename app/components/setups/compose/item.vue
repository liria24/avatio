<script lang="ts" setup>
import { setupEntryShapekeysSchema } from '@avatio/core/setups'

import type { SetupComposeEntry } from '~/composables/setupComposeEntries'

const unsupported = defineModel<boolean>('unsupported', {
    default: false,
})
const shapekeys = defineModel<SetupEntryShapekey[]>('shapekeys', {
    default: () => [],
})
const note = defineModel<string | undefined>('note', {
    default: '',
})

interface Props {
    item: SetupComposeEntry
    images?: string[]
    index: number
    count: number
}
const props = defineProps<Props>()

const emit = defineEmits([
    'change-category',
    'remove-item',
    'shapekey-add',
    'shapekey-remove',
    'place-item',
    'move',
])

const itemCategory = useItemCategory()
const { t } = useI18n()

const inputShapekeyName = ref('')
const inputShapekeyValue = ref(0)
const shapekeyName = useTemplateRef<{ inputRef: HTMLInputElement }>('shapekeyName')
const shapekeyValue = useTemplateRef<{ inputRef: HTMLInputElement }>('shapekeyValue')
const shapekeyPanel = useTemplateRef<HTMLElement>('shapekeyPanel')
const shapekeyError = ref('')
const shapekeyAnnouncement = ref('')
const errorId = useId()

const addKey = () => {
    const result = setupEntryShapekeysSchema.safeParse({
        name: inputShapekeyName.value.trim(),
        value: inputShapekeyValue.value,
    })
    if (!result.success || shapekeys.value.length >= 64) {
        shapekeyError.value = t(
            shapekeys.value.length >= 64
                ? 'dynamicFields.shapekeyLimit'
                : 'dynamicFields.shapekeyInvalid',
        )
        const target =
            !result.success && result.error.issues[0]?.path[0] === 'value'
                ? shapekeyValue
                : shapekeyName
        target.value?.inputRef.focus()
        return
    }
    emit('shapekey-add', { category: props.item.category, id: props.item.id, ...result.data })
    inputShapekeyName.value = ''
    inputShapekeyValue.value = 0
    shapekeyError.value = ''
    shapekeyAnnouncement.value = t('dynamicFields.added', { name: result.data.name })
    shapekeyName.value?.inputRef.focus()
}
const removeKey = async (index: number) => {
    const name = shapekeys.value[index]?.name
    emit('shapekey-remove', { category: props.item.category, id: props.item.id, index })
    await nextTick()
    const buttons =
        shapekeyPanel.value?.querySelectorAll<HTMLButtonElement>('[data-shapekey-remove]')
    const target = buttons?.[Math.min(index, buttons.length - 1)] ?? shapekeyName.value?.inputRef
    target?.focus()
    shapekeyError.value = ''
    shapekeyAnnouncement.value = t('dynamicFields.removed', { name })
}
const imagePlacementItems = computed(() =>
    (props.images ?? []).map((image, index) => ({
        label: `${t('setup.compose.images.title')} ${index + 1}`,
        onSelect: () => emit('place-item', image),
    })),
)
</script>

<template>
    <div
        :data-entry-id="props.item.id"
        role="group"
        :aria-label="props.item.name"
        class="ring-accented flex items-start gap-2 rounded-md p-2 ring-1"
    >
        <div
            class="draggable hover:bg-elevated grid h-full cursor-move rounded-md px-1 py-2 transition-colors"
        >
            <Icon name="mingcute:dots-fill" size="18" class="text-muted shrink-0 self-center" />
        </div>

        <div class="flex grow flex-col gap-2">
            <div class="flex items-start gap-1">
                <NuxtLink
                    v-if="props.item.image && props.item.primarySource"
                    :to="props.item.primarySource?.canonicalUrl"
                    target="_blank"
                    external
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
                            v-if="props.item.primarySource?.providerKey === 'booth'"
                            text="BOOTH"
                            :delay-duration="50"
                        >
                            <Icon name="avatio:booth" size="16" class="text-muted shrink-0" />
                        </UTooltip>

                        <UTooltip
                            v-else-if="props.item.primarySource?.providerKey === 'github'"
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
                            v-if="props.item.primarySource"
                            :to="props.item.primarySource?.canonicalUrl"
                            target="_blank"
                            external
                            class="text-toned line-clamp-2 py-1 font-mono text-sm tracking-wider"
                        >
                            {{ props.item.name }}
                        </NuxtLink>
                        <span
                            v-else
                            class="text-muted line-clamp-2 py-1 font-mono text-sm tracking-wider"
                        >
                            {{ props.item.name }}
                        </span>
                    </div>
                    <div class="flex items-center gap-2">
                        <UPopover
                            v-if="
                                ['avatar', 'hair', 'clothing', 'accessory'].includes(
                                    props.item.category,
                                )
                            "
                        >
                            <UButton
                                :label="`${$t('setup.compose.items.shapekeys')}: ${shapekeys?.length || 0}`"
                                variant="subtle"
                                size="sm"
                            />

                            <template #content>
                                <fieldset
                                    ref="shapekeyPanel"
                                    class="flex min-w-0 flex-col items-center gap-2 p-2"
                                >
                                    <legend class="sr-only">
                                        {{
                                            $t('dynamicFields.shapekeysFor', {
                                                name: props.item.name,
                                            })
                                        }}
                                    </legend>
                                    <p
                                        role="status"
                                        aria-live="polite"
                                        aria-atomic="true"
                                        class="sr-only"
                                    >
                                        {{ shapekeyAnnouncement }}
                                    </p>
                                    <p v-if="!shapekeys?.length" class="text-muted p-3 text-sm">
                                        {{ $t('setup.compose.items.noShapekeys') }}
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
                                                :aria-label="
                                                    $t('dynamicFields.remove', {
                                                        name: shapekey.name,
                                                    })
                                                "
                                                data-shapekey-remove
                                                icon="mingcute:close-line"
                                                variant="ghost"
                                                size="sm"
                                                @click="removeKey(index)"
                                            />
                                        </div>
                                    </template>
                                    <div class="flex items-center gap-1">
                                        <UInput
                                            ref="shapekeyName"
                                            v-model="inputShapekeyName"
                                            :aria-label="$t('dynamicFields.shapekeyName')"
                                            :aria-invalid="!!shapekeyError"
                                            :aria-describedby="shapekeyError ? errorId : undefined"
                                            :placeholder="
                                                $t('setup.compose.items.shapekeyPlaceholder')
                                            "
                                            size="sm"
                                            class="max-w-48"
                                            @keydown.enter.prevent="addKey"
                                        />
                                        <UInputNumber
                                            ref="shapekeyValue"
                                            v-model="inputShapekeyValue"
                                            :aria-label="$t('dynamicFields.shapekeyValue')"
                                            :aria-invalid="!!shapekeyError"
                                            :aria-describedby="shapekeyError ? errorId : undefined"
                                            :step="0.001"
                                            orientation="vertical"
                                            size="sm"
                                            class="max-w-32"
                                            @keydown.enter.prevent="addKey"
                                        />
                                        <UButton
                                            :aria-label="$t('dynamicFields.addShapekey')"
                                            icon="mingcute:add-line"
                                            variant="soft"
                                            size="sm"
                                            @click="addKey"
                                        />
                                    </div>
                                    <p
                                        v-if="shapekeyError"
                                        :id="errorId"
                                        role="alert"
                                        class="text-error max-w-80 text-sm"
                                    >
                                        {{ shapekeyError }}
                                    </p>
                                </fieldset>
                            </template>
                        </UPopover>

                        <UCheckbox
                            v-if="props.item.category !== 'avatar'"
                            v-model="unsupported"
                            :label="$t('setup.compose.items.incompatible')"
                            size="sm"
                            :ui="{ label: 'text-muted' }"
                        />
                    </div>
                </div>

                <ReorderControls
                    :name="props.item.name"
                    :index="props.index"
                    :count="props.count"
                    @move="emit('move', $event)"
                />
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
                        :aria-label="$t('setup.compose.items.changeCategory')"
                        :icon="itemCategory[props.item.category]?.icon || 'mingcute:box-3-fill'"
                        variant="ghost"
                        size="sm"
                    />
                </UDropdownMenu>

                <UButton
                    :aria-label="$t('dynamicFields.remove', { name: props.item.name })"
                    data-remove
                    icon="mingcute:close-line"
                    variant="ghost"
                    size="sm"
                    @click="emit('remove-item')"
                />
            </div>

            <UTextarea
                v-model="note"
                :aria-label="$t('dynamicFields.noteFor', { name: props.item.name })"
                :placeholder="$t('setup.compose.items.notePlaceholder')"
                autoresize
                size="sm"
                :rows="1"
                variant="soft"
                class="w-full"
            />

            <UDropdownMenu v-if="imagePlacementItems.length" :items="imagePlacementItems">
                <UButton
                    :label="$t('setup.compose.points.placeItem')"
                    icon="mingcute:map-pin-fill"
                    variant="ghost"
                    size="xs"
                    class="ml-auto"
                />
            </UDropdownMenu>
        </div>
    </div>
</template>
