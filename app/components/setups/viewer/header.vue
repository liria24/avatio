<script lang="ts" setup>
interface Props {
    preview?: boolean;
    id?: number;
    createdAt?: string;
    title: string;
    description?: string | null;
    author: Author;
}

const { preview, id, createdAt, title, description, author } =
    defineProps<Props>();

const emit = defineEmits(['login']);

const user = useSupabaseUser();

const bookmark = ref(false);
const modalDelete = ref(false);

const toggleBookmark = async () => {
    if (!id) return;
    if (!user.value) return emit('login');

    if (bookmark.value) await useRemoveBookmark(id);
    else await useAddBookmark(id);

    bookmark.value = await useCheckBookmark(id);
};

const remove = () => {
    if (!id) return;
    modalDelete.value = true;
};
</script>

<template>
    <div class="w-full flex flex-col gap-3">
        <h1
            class="w-full text-left text-2xl font-bold line-clamp-2 break-keep [overflow-wrap:anywhere;] text-black dark:text-white"
        >
            {{ useSentence(title) }}
        </h1>

        <div class="w-full gap-3 flex flex-wrap items-center">
            <div class="grow flex flex-wrap items-center gap-x-5 gap-y-2">
                <NuxtLink
                    :to="`/@${author.id}`"
                    class="flex flex-row gap-1 items-center"
                >
                    <UiAvatar
                        :url="
                            author.avatar
                                ? useGetImage(author.avatar, {
                                      prefix: 'avatar',
                                  })
                                : ''
                        "
                        :alt="author.name"
                    />
                    <p
                        class="pl-2 text-black dark:text-white pb-0.5 text-left font-normal"
                    >
                        {{ author.name }}
                    </p>
                    <BadgeUser :badges="author.badges" size="sm" />
                </NuxtLink>

                <div v-if="createdAt?.length" class="flex items-center gap-2">
                    <p
                        class="text-sm text-zinc-500 dark:text-zinc-400 whitespace-nowrap leading-none"
                    >
                        {{ useLocaledDate(new Date(createdAt)) }}
                        に公開
                    </p>
                </div>
            </div>

            <div v-if="!preview" class="flex items-center gap-1">
                <Button
                    v-if="user?.id !== author.id"
                    :tooltip="
                        bookmark ? 'ブックマークから削除' : 'ブックマーク'
                    "
                    :icon="bookmark ? 'lucide:bookmark-x' : 'lucide:bookmark'"
                    :aria-label="
                        bookmark ? 'ブックマークから削除' : 'ブックマーク'
                    "
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
                    v-if="user?.id === author.id"
                    tooltip="削除"
                    aria-label="削除"
                    icon="lucide:trash"
                    :icon-size="18"
                    variant="flat"
                    class="p-2.5 hover:bg-zinc-300 hover:dark:bg-zinc-600"
                    icon-class="text-red-400 dark:text-red-300"
                    @click="remove"
                />

                <ModalDeleteSetup v-model="modalDelete" :id="Number(id)" />

                <PopupShare
                    :setup-name="title"
                    :setup-description="description ?? ''"
                    :setup-author="author.name"
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
        </div>
    </div>
</template>
