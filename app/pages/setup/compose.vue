<script lang="ts" setup>
import { cn } from 'cn'

definePageMeta({
    auth: 'user',
    layout: 'compose',
})

const itemCategory = useItemCategory()
const {
    form,
    values,
    draft,
    loadDraft,
    addTag,
    removeTag,
    editingSetupId,
    publishing,
    coauthors,
    addCoauthor,
    removeCoauthor,
    setCoauthors,
    updateCoauthorNote,
    entries,
    totalItemsCount,
    addItem,
    removeItem,
    changeItemCategory,
    addShapekey,
    removeShapekey,
    updateItem,
    reorderCategory,
} = useSetupCompose()
const { data: tags } = useSetupTags({
    transform: (tags) => tags.map((tag) => tag.tag),
})

const openTagPopover = ref(false)

const itemCategories = itemCategorySchema.options

const getItemsByCategory = (category: ItemCategory) =>
    entries.value.filter((entry) => entry.category === category)

const randomSeed = Math.random()
const images = [
    { src: `https://picsum.photos/seed/${randomSeed}/128`, alt: 'Image 1', points: 6 },
    { src: `https://picsum.photos/seed/${randomSeed + 1}/128`, alt: 'Image 2', points: 0 },
    { src: `https://picsum.photos/seed/${randomSeed + 2}/128`, alt: 'Image 3', points: 3 },
]
const suggestedItems = [
    {
        id: '4258074',
        label: '結晶化した角 // アバターアクセサリー',
        image: 'https://booth.pximg.net/71691351-b285-40e7-af97-09cd9976f902/i/4258074/131f0b29-ee97-4e05-9acf-407788dd17ef_base_resized.jpg',
    },
    {
        id: '4758318',
        label: 'チャームチョーカー // アバターアクセサリー',
        image: 'https://booth.pximg.net/71691351-b285-40e7-af97-09cd9976f902/i/4758318/ad7ce9a5-5375-471a-bcfd-0b8b5bdda437_base_resized.jpg',
    },
]
</script>

<template>
    <UForm class="flex size-full flex-col gap-6 px-1">
        <div class="flex items-center gap-3">
            <h1 class="mr-auto text-2xl font-bold">セットアップ作成</h1>

            <SetupsComposeDraftsModal
                :referenced-draft-id="draft.status === 'new' ? undefined : draft.id"
                @load="loadDraft($event)"
            >
                <UButton
                    :label="$t('setup.compose.draftButton')"
                    icon="mingcute:circle-dash-fill"
                    variant="subtle"
                    size="sm"
                    :ui="{ leadingIcon: 'size-4' }"
                    class="rounded-full"
                />
            </SetupsComposeDraftsModal>

            <UBadge
                icon="mingcute:check-line"
                label="保存しました"
                variant="soft"
                class="rounded-full px-3"
            />

            <UButton
                type="submit"
                :label="
                    editingSetupId
                        ? $t('setup.compose.updateButton')
                        : $t('setup.compose.publishButton')
                "
                icon="mingcute:upload-fill"
                color="neutral"
                :loading="publishing"
                :ui="{ leadingIcon: 'size-5' }"
                class="rounded-full px-12 py-2.5"
            />
        </div>

        <USplitter
            id="splitter-items"
            :items="[
                {
                    slot: 'sidebar',
                    minSize: 30,
                    defaultSize: 40,
                    class: 'ring ring-inset ring-muted/50 bg-elevated/30 rounded-xl flex flex-col gap-8 p-4 sm:p-6',
                },
                {
                    slot: 'main',
                    minSize: 30,
                    defaultSize: 60,
                    class: 'ring ring-inset ring-muted/50 bg-elevated/30 rounded-xl flex flex-col gap-4 p-4 sm:p-6',
                },
            ]"
        >
            <template #sidebar>
                <!-- TODO: 種別がnameだとブラウザの自動入力で氏名が入る場合があるので修正したい -->
                <form.Field v-slot="{ field }" name="name">
                    <UFormField name="name" label="$t('setup.compose.nameLabel')" required>
                        <UInput
                            :model-value="field.value"
                            :placeholder="$t('setup.compose.namePlaceholder')"
                            variant="none"
                            size="xl"
                            class="border-muted w-full border-b"
                            @blur="field.handleBlur"
                            @keydown.enter.prevent
                            @update:model-value="field.handleChange"
                        />
                    </UFormField>
                </form.Field>

                <div class="flex items-start gap-3">
                    <div
                        v-for="(image, index) in images"
                        :key="`image-${index}`"
                        class="group flex flex-col gap-1"
                    >
                        <div
                            class="relative size-32 cursor-move overflow-clip rounded-lg object-cover select-none"
                        >
                            <img :src="image.src" />
                            <div
                                class="absolute inset-0 flex items-center justify-center bg-white/30 opacity-0 transition-opacity group-hover:opacity-100 dark:bg-black/30"
                            >
                                <Icon
                                    name="mingcute:dots-line"
                                    size="24"
                                    class="text-highlighted"
                                />
                            </div>
                            <div
                                class="absolute inset-0 rounded-lg ring-2 ring-black/10 ring-inset dark:ring-white/15"
                            />
                            <UButton
                                aria-label="画像を削除"
                                icon="mingcute:close-line"
                                variant="ghost"
                                :ui="{ leadingIcon: 'text-highlighted' }"
                                class="absolute top-1.5 right-1.5 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                            />
                        </div>

                        <UButton
                            aria-label="画像に関連づけられたアイテム"
                            :label="image.points.toString()"
                            icon="mingcute:map-pin-fill"
                            variant="soft"
                            size="xs"
                            :ui="{ leadingIcon: 'size-3.5' }"
                            :class="
                                cn(
                                    'ml-auto rounded-full px-3',
                                    image.points === 0 &&
                                        'opacity-0 transition-opacity group-hover:opacity-100',
                                )
                            "
                        />
                    </div>

                    <UButton
                        aria-label="画像を追加"
                        icon="mingcute:add-line"
                        variant="soft"
                        :ui="{ leadingIcon: 'm-auto size-6' }"
                        class="size-32 rounded-lg"
                    />
                </div>

                <form.Field v-slot="{ field }" name="description">
                    <UFormField name="description" :label="$t('setup.compose.descriptionLabel')">
                        <UTextarea
                            :model-value="field.value"
                            :placeholder="$t('setup.compose.descriptionPlaceholder')"
                            autoresize
                            :rows="6"
                            variant="soft"
                            class="w-full"
                            @blur="field.handleBlur"
                            @update:model-value="field.handleChange"
                        />
                    </UFormField>
                </form.Field>

                <UFormField name="tags" :label="$t('setup.compose.tags.title')">
                    <div class="flex flex-col gap-2">
                        <UPopover
                            v-model:open="openTagPopover"
                            :dismissible="false"
                            :ui="{ content: 'w-(--reka-popover-trigger-width) p-4' }"
                        >
                            <template #anchor>
                                <UInput
                                    placeholder="タグを入力"
                                    variant="soft"
                                    @focus="openTagPopover = true"
                                    @blur="openTagPopover = false"
                                />
                            </template>

                            <template #content>
                                <UScrollArea class="max-h-64">
                                    <UButton
                                        v-for="tag in tags"
                                        :key="tag"
                                        :label="tag"
                                        variant="ghost"
                                        class="w-full"
                                        @click="addTag(tag)"
                                    />
                                </UScrollArea>
                            </template>
                        </UPopover>

                        <div class="flex flex-wrap items-center gap-2">
                            <UBadge
                                v-for="tag in values.tags"
                                :key="tag"
                                :label="tag"
                                variant="soft"
                                class="py-1 pr-1 pl-3"
                            >
                                <template #trailing>
                                    <UButton
                                        icon="mingcute:close-line"
                                        variant="ghost"
                                        size="xs"
                                        @click="removeTag(tag)"
                                    />
                                </template>
                            </UBadge>
                        </div>
                    </div>
                </UFormField>

                <UFormField name="coauthors" :label="$t('setup.compose.coauthors.title')">
                    <div class="flex flex-col gap-2">
                        <VueDraggable
                            :model-value="coauthors"
                            :animation="150"
                            handle=".draggable"
                            drag-class="opacity-100"
                            ghost-class="opacity-0"
                            class="flex h-full w-full flex-col gap-2 empty:hidden"
                            @update:model-value="setCoauthors"
                        >
                            <div
                                v-for="coauthor in coauthors"
                                :key="`coauthor-${coauthor.userId}`"
                                class="ring-accented flex items-stretch gap-2 rounded-md p-2 ring-1"
                            >
                                <div
                                    class="draggable hover:bg-elevated grid cursor-move rounded-md px-1 py-2 transition-colors"
                                >
                                    <Icon
                                        name="mingcute:dots-fill"
                                        size="18"
                                        class="text-muted shrink-0 self-center"
                                    />
                                </div>

                                <div class="flex grow flex-col gap-2">
                                    <div class="flex items-center gap-2">
                                        <UAvatar
                                            :src="coauthor.user.image || undefined"
                                            :alt="coauthor.user.name || 'User'"
                                            icon="mingcute:user-3-fill"
                                            size="xs"
                                        />
                                        <span class="text-toned grow text-xs">
                                            {{ coauthor.user.name }}
                                        </span>
                                        <UButton
                                            icon="mingcute:close-line"
                                            variant="ghost"
                                            size="xs"
                                            @click="removeCoauthor(coauthor.userId)"
                                        />
                                    </div>
                                    <UInput
                                        :model-value="coauthor.note"
                                        :placeholder="$t('setup.compose.coauthors.note')"
                                        size="sm"
                                        @update:model-value="
                                            updateCoauthorNote(coauthor.userId, $event)
                                        "
                                    />
                                </div>
                            </div>
                        </VueDraggable>

                        <UPopover :content="{ side: 'right', align: 'start' }">
                            <UButton
                                icon="mingcute:add-line"
                                :label="
                                    coauthors.length
                                        ? undefined
                                        : $t('setup.compose.coauthors.placeholder')
                                "
                                variant="soft"
                                block
                            />

                            <template #content>
                                <CommandPaletteUserSearch @select="addCoauthor" />
                            </template>
                        </UPopover>
                    </div>
                </UFormField>

                <form.Field v-slot="{ field }" name="public">
                    <USwitch
                        :model-value="!field.value"
                        :label="$t('setup.compose.limitedPublic')"
                        :description="$t('setup.compose.limitedPublicDescription')"
                        color="neutral"
                        :ui="{ description: 'text-xs mt-1' }"
                        class="mt-auto"
                        @update:model-value="(value) => field.handleChange(!value)"
                    />
                </form.Field>
            </template>

            <template #main>
                <div v-if="!totalItemsCount" class="m-auto flex flex-col items-center gap-6">
                    <p class="text-xl">アバター改変に使用したアイテムをリストしましょう</p>
                    <UFormField
                        help="対応プラットフォーム: BOOTH, GitHub"
                        :ui="{ help: 'px-1 text-xs text-dimmed' }"
                    >
                        <UInput
                            placeholder="アイテムを検索 / URLを入力"
                            icon="mingcute:package-2-fill"
                            variant="soft"
                            size="lg"
                            class="min-w-sm"
                        />
                    </UFormField>
                    <div class="flex max-w-md flex-wrap items-center gap-4">
                        <UTooltip
                            v-for="(item, index) in suggestedItems"
                            :key="`suggested-item-${index}`"
                            :text="item.label"
                            :delay-duration="50"
                            class="overflow-clip rounded-lg object-cover"
                        >
                            <button type="button" class="group relative cursor-pointer">
                                <NuxtImg :src="item.image" :alt="item.label" class="size-20" />
                                <div
                                    class="absolute inset-0 flex items-center justify-center bg-white/50 opacity-0 transition-opacity group-hover:opacity-100 dark:bg-black/60"
                                >
                                    <Icon
                                        name="mingcute:add-line"
                                        size="24"
                                        class="text-highlighted"
                                    />
                                </div>
                                <div
                                    class="absolute inset-0 rounded-lg ring-2 ring-black/10 ring-inset dark:ring-white/15"
                                />
                            </button>
                        </UTooltip>
                    </div>
                </div>

                <div
                    v-else
                    class="flex w-full scrollbar-thin scrollbar-thumb-(--ui-bg-accented) scrollbar-track-transparent flex-col gap-6 overflow-y-auto"
                >
                    <div
                        v-for="category in itemCategories"
                        :key="`item-category-${category}`"
                        class="flex flex-col gap-4 empty:hidden"
                    >
                        <template v-if="getItemsByCategory(category).length">
                            <div class="flex items-center gap-2">
                                <Icon
                                    :name="itemCategory[category]?.icon || 'mingcute:box-3-fill'"
                                    :size="22"
                                    class="text-muted shrink-0"
                                />
                                <h2
                                    class="text-toned font-mono leading-none font-semibold text-nowrap"
                                >
                                    {{ itemCategory[category]?.label || category }}
                                </h2>
                            </div>

                            <VueDraggable
                                :model-value="getItemsByCategory(category)"
                                :animation="150"
                                handle=".draggable"
                                drag-class="opacity-100"
                                ghost-class="opacity-0"
                                class="flex h-full w-full flex-col gap-2"
                                @update:model-value="reorderCategory(category, $event)"
                            >
                                <SetupsComposeItem
                                    v-for="item in getItemsByCategory(category)"
                                    :key="`item-${item.id}`"
                                    :unsupported="item.unsupported"
                                    :shapekeys="item.shapekeys"
                                    :note="item.note"
                                    :item="item"
                                    @change-category="changeItemCategory(item.id, $event)"
                                    @remove-item="removeItem(item.category, item.id)"
                                    @shapekey-add="addShapekey($event)"
                                    @shapekey-remove="removeShapekey($event)"
                                    @update:unsupported="
                                        updateItem(item.itemId, { unsupported: $event })
                                    "
                                    @update:note="updateItem(item.itemId, { note: $event || '' })"
                                />
                            </VueDraggable>
                        </template>
                    </div>
                </div>

                <div class="flex w-full items-center justify-end gap-2">
                    <div
                        :data-exceeded="totalItemsCount > 32"
                        class="ring-accented ml-1 flex items-center gap-1.5 rounded-full py-1 pr-3 pl-2.5 ring-1 data-[exceeded=true]:ring-red-500"
                    >
                        <Icon
                            name="mingcute:package-2-fill"
                            size="16"
                            class="text-muted shrink-0"
                        />
                        <span class="font-mono text-xs leading-none text-nowrap">
                            <span>{{ totalItemsCount }}</span>
                            <span v-if="totalItemsCount > 32">/ 32</span>
                        </span>
                    </div>
                </div>
            </template>
        </USplitter>
    </UForm>
</template>
