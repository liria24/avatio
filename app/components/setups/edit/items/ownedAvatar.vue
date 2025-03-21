<script lang="ts" setup>
const emit = defineEmits(['add']);

const quickAvatarsOwned = ref<
    { id: number; name: string; thumbnail: string }[] | null
>(null);

const getOwnedAvatars = async () => {
    const client = useSupabaseClient();
    const user = useSupabaseUser();

    if (!user.value) return null;

    const { data } = await client
        .from('setups')
        .select(
            `
            items:setup_items(
                data:item_id(
                    id, outdated, category, name, thumbnail, nsfw
                )
            )
            `
        )
        .eq('author', user.value.id)
        .eq('setup_items.item_id.category', 'avatar')
        .order('created_at', { ascending: false })
        .limit(30)
        .returns<
            {
                items: {
                    data: {
                        id: number;
                        outdated: boolean;
                        category: string;
                        name: string;
                        thumbnail: string;
                        nsfw: boolean;
                    };
                }[];
            }[]
        >();

    if (!data) return null;

    const avatars = [
        ...new Map(
            data
                .map((s) => s.items.filter((i) => i.data).map((i) => i.data))
                .flat()
                .flat()
                .map((obj) => [obj.id, obj])
        ).values(),
    ].slice(0, 6);

    return avatars;
};

quickAvatarsOwned.value = await getOwnedAvatars();
</script>

<template>
    <div class="flex flex-wrap gap-2 items-center justify-center">
        <Button
            v-for="i in quickAvatarsOwned"
            :key="'owned-avatar-' + i.id"
            class="p-1 pr-2.5"
            @click="emit('add', i.id)"
        >
            <NuxtImg
                :src="i.thumbnail"
                width="40"
                height="40"
                class="rounded-lg"
            />
            <span>{{ useAvatarName(i.name) }}</span>
        </Button>
    </div>
</template>
