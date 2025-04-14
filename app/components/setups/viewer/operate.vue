<script lang="ts" setup>
interface Props {
    preview?: boolean;
    id?: number;
    title: string;
    description?: string | null;
    author: Author;
    class?: string | string[];
}
const props = defineProps<Props>();

const emit = defineEmits(['login']);

const user = useSupabaseUser();

const bookmark = ref(false);
const modalDelete = ref(false);

const toggleBookmark = async () => {
    if (!props.id) return;
    if (!user.value) return emit('login');

    if (bookmark.value) await useRemoveBookmark(props.id);
    else await useAddBookmark(props.id);

    bookmark.value = await useCheckBookmark(props.id);
};

const remove = () => {
    if (!props.id) return;
    modalDelete.value = true;
};
</script>

<template>
    <div v-if="!preview" class="flex items-center gap-1">
        <Button
            v-if="user?.id !== props.author.id"
            :tooltip="bookmark ? 'ブックマークから削除' : 'ブックマーク'"
            :icon="bookmark ? 'lucide:bookmark-x' : 'lucide:bookmark'"
            :aria-label="bookmark ? 'ブックマークから削除' : 'ブックマーク'"
            variant="flat"
            class="p-2.5 hover:bg-zinc-300 hover:dark:bg-zinc-600"
            :icon-class="
                bookmark
                    ? 'text-red-500 dark:text-red-400'
                    : 'text-zinc-600 dark:text-zinc-300'
            "
            @click="toggleBookmark"
        />

        <Button
            v-if="user?.id === props.author.id"
            tooltip="削除"
            aria-label="削除"
            icon="lucide:trash"
            :icon-size="18"
            variant="flat"
            class="p-2.5 hover:bg-zinc-300 hover:dark:bg-zinc-600"
            icon-class="text-red-400 dark:text-red-300"
            @click="remove"
        />

        <ModalDeleteSetup v-model="modalDelete" :id="Number(props.id)" />

        <PopupShare
            :setup-name="props.title"
            :setup-description="props.description ?? ''"
            :setup-author="props.author.name"
        >
            <Button
                icon="lucide:share-2"
                :icon-size="18"
                tooltip="シェア"
                aria-label="シェア"
                aria-expanded="false"
                variant="flat"
                class="p-2.5 hover:bg-zinc-300 hover:dark:bg-zinc-600"
            />
        </PopupShare>
    </div>
</template>
