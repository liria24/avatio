<script lang="ts" setup>
const vis = defineModel<boolean>({
    default: false,
})

interface Props {
    from: SetupItem | null
    to: SetupItem | null
}
const props = defineProps<Props>()

const emit = defineEmits(['accept', 'close'])

const onReplace = () => {
    emit('accept')
    emit('close')
}
</script>

<template>
    <Modal v-model="vis">
        <template #header>
            <UiTitle
                label="ベースアバターの置換"
                icon="lucide:arrow-right-left"
            />
        </template>

        <div class="flex flex-col items-center gap-4">
            <p>ベースアバターを置き換えますか？</p>

            <div class="flex flex-col items-center gap-2 p-1">
                <SetupsViewerItem
                    v-if="props.from"
                    no-action
                    :item="props.from"
                />
                <Icon name="lucide:arrow-down" size="24" class="bg-zinc-300" />
                <SetupsViewerItem v-if="props.to" no-action :item="props.to" />
            </div>
        </div>

        <template #footer>
            <div class="flex w-full items-center justify-end gap-2">
                <Button label="置換" @click="onReplace" />
                <Button label="キャンセル" @click="() => emit('close')" />
            </div>
        </template>
    </Modal>
</template>
