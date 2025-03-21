<script lang="ts" setup>
const vis = defineModel<boolean>({
    default: false,
});

interface Props {
    from: SetupItem | null;
    to: SetupItem | null;
}
const props = defineProps<Props>();

const emit = defineEmits(['accept', 'close']);
</script>

<template>
    <Modal v-model="vis">
        <template #header>
            <UiTitle
                label="ベースアバターの置換"
                icon="lucide:arrow-right-left"
            />
        </template>

        <div class="gap-4 flex flex-col items-center">
            <p>ベースアバターを置き換えますか？</p>

            <div class="p-1 gap-2 flex flex-col items-center">
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
            <div class="w-full flex gap-2 items-center justify-end">
                <Button
                    label="置換"
                    @click="
                        emit('accept');
                        emit('close');
                    "
                />
                <Button label="キャンセル" @click="() => emit('close')" />
            </div>
        </template>
    </Modal>
</template>
