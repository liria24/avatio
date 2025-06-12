<script lang="ts" setup>
import { VueDraggable } from 'vue-draggable-plus'

const links = defineModel<string[]>({ default: [] })

const linkInput = ref<string>('')

const addLink = async () => {
    if (linkInput.value === '') return

    if (links.value.includes(linkInput.value))
        return useToast().add('リンクが重複しています')

    if (links.value.length >= 8)
        return useToast().add('リンクは最大 8 つまでです')

    try {
        new URL(linkInput.value)
    } catch {
        return useToast().add('URL が不正です')
    }

    links.value.push(linkInput.value)
    linkInput.value = ''
}

const removeLink = async (link: string) => {
    links.value = links.value.filter((i) => i !== link)
}

const pasteFromClipboard = async () =>
    (linkInput.value = await navigator.clipboard.readText())
</script>

<template>
    <div class="flex w-full flex-col gap-2">
        <div class="flex w-full items-center gap-1">
            <UiTextinput
                v-model="linkInput"
                autocomplete="off"
                placeholder="リンクを入力"
                class="grow"
                @keyup.enter="addLink"
            >
                <template #trailing>
                    <Button
                        v-if="!linkInput"
                        variant="flat"
                        icon="lucide:clipboard"
                        class="p-1"
                        @click="pasteFromClipboard"
                    />
                    <Button
                        v-if="linkInput !== ''"
                        variant="flat"
                        icon="lucide:x"
                        class="p-1"
                        @click="linkInput = ''"
                    />
                </template>
            </UiTextinput>
            <Button
                label="追加"
                size="sm"
                class="h-[40px] pr-3"
                @click="addLink"
            />
        </div>

        <VueDraggable
            v-model="links"
            :animation="150"
            handle=".draggable"
            class="flex w-full flex-wrap items-center gap-2 empty:hidden"
        >
            <UiTooltip
                v-for="(i, index) in links"
                :key="'link-' + index"
                :text="i"
            >
                <div
                    class="flex items-center rounded-lg ring-1 ring-zinc-400 dark:ring-zinc-600"
                >
                    <div class="draggable grid cursor-move px-1.5 py-2.5">
                        <Icon
                            name="lucide:grip-vertical"
                            size="18"
                            class="shrink-0 text-zinc-500 dark:text-zinc-400"
                        />
                    </div>
                    <Icon
                        :name="getLinkInfo(i).icon"
                        size="18"
                        class="shrink-0 p-1 text-zinc-700 dark:text-zinc-300"
                    />
                    <Button
                        icon="lucide:x"
                        variant="flat"
                        class="mx-1 p-1"
                        @click="removeLink(i)"
                    />
                </div>
            </UiTooltip>
        </VueDraggable>
    </div>
</template>
