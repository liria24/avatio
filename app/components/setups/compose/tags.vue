<script lang="ts" setup>
const tags = defineModel<string[]>({
    default: () => [],
})

const toast = useToast()

const addTag = (tag: string) => {
    if (!tag.trim()) return

    if (tags.value.includes(tag)) {
        toast.add({
            title: 'タグを重複して追加することはできません',
            color: 'warning',
        })
        return
    }

    tags.value.push(tag)
}

const removeTag = (tag: string) => {
    const index = tags.value.indexOf(tag)
    if (index !== -1) tags.value.splice(index, 1)
}
</script>

<template>
    <UFormField name="tags" label="タグ">
        <div class="flex flex-wrap items-center gap-2">
            <UBadge
                v-for="tag in tags"
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

            <UPopover :content="{ side: 'right', align: 'start' }">
                <UButton
                    icon="mingcute:add-line"
                    :label="tags.length ? undefined : 'タグを追加'"
                    variant="soft"
                />

                <template #content>
                    <CommandPaletteTagSearch @select="addTag" />
                </template>
            </UPopover>
        </div>
    </UFormField>
</template>
