<script lang="ts" setup>
const { values, addTag, removeTag } = useSetupCompose()
const open = ref(false)
const input = ref('')
const { data: tags } = useSetupTags({
    transform: (result) => result.map(({ tag }) => tag),
})
const suggestions = computed(() => {
    const query = input.value.trim().toLocaleLowerCase()
    return (tags.value ?? [])
        .filter(
            (tag) =>
                !values.value.tags.includes(tag) &&
                (!query || tag.toLocaleLowerCase().includes(query)),
        )
        .slice(0, 24)
})
const choose = (tag: string) => {
    const value = tag.trim().slice(0, 32)
    if (!value) return
    addTag(value)
    input.value = ''
    if (values.value.tags.length >= 8) open.value = false
}
</script>

<template>
    <UFormField name="tags" :label="$t('setup.compose.tags.title')">
        <div class="flex flex-col gap-2">
            <UPopover v-model:open="open" :ui="{ content: 'w-(--reka-popover-trigger-width) p-2' }">
                <template #anchor>
                    <UInput
                        v-model="input"
                        :placeholder="$t('commandPalette.tagSearch.placeholder')"
                        variant="soft"
                        maxlength="32"
                        class="w-full"
                        @focus="open = true"
                        @keydown.enter.prevent="choose(input)"
                        @keydown.escape="open = false"
                    />
                </template>

                <template v-if="suggestions.length" #content>
                    <UScrollArea class="max-h-64">
                        <UButton
                            v-for="tag in suggestions"
                            :key="tag"
                            :label="tag"
                            variant="ghost"
                            class="w-full justify-start"
                            @click="choose(tag)"
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
</template>
