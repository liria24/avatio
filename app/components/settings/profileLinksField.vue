<script lang="ts" setup>
const props = defineProps<{
    modelValue: string[]
    error?: string
}>()

const emit = defineEmits<{
    'update:modelValue': [links: string[]]
}>()

const { t } = useI18n()
const toast = useToast()

const newLink = ref('')
const editingLink = ref('')

const validateLink = (value: string, currentIndex = -1) => {
    const trimmedLink = value.trim()
    if (!trimmedLink) return

    try {
        new URL(trimmedLink)
    } catch {
        toast.add({
            id: 'link-invalid',
            icon: 'mingcute:close-line',
            title: t('settings.general.toast.invalidLink'),
            description: t('settings.general.toast.invalidLinkDescription'),
            color: 'error',
        })
        return
    }

    if (props.modelValue.some((link, index) => link === trimmedLink && index !== currentIndex)) {
        toast.add({
            id: 'link-duplicate',
            icon: 'mingcute:warning-line',
            title: t('settings.general.toast.linkExists'),
            description: t('settings.general.toast.linkExistsDescription'),
            color: 'warning',
        })
        return
    }

    return trimmedLink
}

const addLink = () => {
    const link = validateLink(newLink.value)
    if (!link) return false

    emit('update:modelValue', [...props.modelValue, link])
    newLink.value = ''
    return true
}

const editLink = (index: number, close: () => void) => {
    if (index < 0 || index >= props.modelValue.length) return
    const link = validateLink(editingLink.value, index)
    if (!link) return
    emit(
        'update:modelValue',
        props.modelValue.map((current, candidate) => (candidate === index ? link : current)),
    )
    close()
}

const removeLink = (index: number) => {
    if (index < 0 || index >= props.modelValue.length) return
    emit(
        'update:modelValue',
        props.modelValue.filter((_, candidate) => candidate !== index),
    )
}
</script>

<template>
    <UFormField
        name="links"
        :label="$t('settings.general.profile.links')"
        :error="error"
        class="w-full"
    >
        <SortableList
            :model-value="modelValue"
            handle=".link-drag"
            class="flex flex-col"
            @update:model-value="emit('update:modelValue', $event)"
        >
            <div
                v-for="(statelink, index) in modelValue"
                :key="statelink"
                class="hover:bg-elevated flex items-center gap-2 rounded-md p-2 transition-colors"
            >
                <Icon
                    name="mingcute:dots-fill"
                    size="18"
                    class="link-drag text-muted shrink-0 cursor-move"
                />

                <UTooltip :text="statelink" :delay-duration="50">
                    <Icon
                        :name="useLinkAttributes(statelink).icon"
                        size="18"
                        class="text-toned shrink-0"
                    />
                </UTooltip>

                <p class="line-clamp-1 text-sm leading-none break-all">
                    {{ statelink }}
                </p>

                <UPopover :content="{ side: 'bottom' }">
                    <UButton
                        type="button"
                        :aria-label="$t('settings.general.profile.editLink')"
                        icon="mingcute:edit-2-fill"
                        variant="ghost"
                        size="sm"
                        class="ml-auto"
                        @click="editingLink = statelink"
                    />

                    <template #content="{ close }">
                        <div class="flex max-w-96 items-center gap-2 p-2">
                            <UInput
                                v-model="editingLink"
                                :placeholder="$t('settings.general.profile.editLink')"
                                class="w-full"
                                @keyup.enter.prevent="editLink(index, close)"
                            />
                            <UButton
                                type="button"
                                :label="$t('save')"
                                variant="soft"
                                color="neutral"
                                :disabled="!editingLink.trim()"
                                @click="editLink(index, close)"
                            />
                        </div>
                    </template>
                </UPopover>
                <UButton
                    type="button"
                    :aria-label="$t('settings.general.profile.removeLink')"
                    icon="mingcute:close-line"
                    variant="ghost"
                    size="sm"
                    @click="removeLink(index)"
                />
            </div>
        </SortableList>

        <div class="flex items-center gap-1">
            <UPopover :content="{ side: 'bottom' }">
                <UButton
                    v-if="modelValue.length < 8"
                    type="button"
                    icon="mingcute:add-line"
                    :label="$t('settings.general.profile.addLink')"
                    variant="ghost"
                    block
                    class="p-2"
                />

                <template #content>
                    <div class="flex max-w-96 items-center gap-2 p-2">
                        <UInput
                            v-model="newLink"
                            :placeholder="$t('settings.general.profile.addLink')"
                            class="w-full"
                            @keyup.enter.prevent="addLink()"
                        />
                        <UButton
                            type="button"
                            :label="$t('add')"
                            variant="soft"
                            color="neutral"
                            :disabled="!newLink.trim()"
                            @click="addLink()"
                        />
                    </div>
                </template>
            </UPopover>
        </div>
    </UFormField>
</template>
