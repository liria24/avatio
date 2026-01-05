<script lang="ts" setup>
const emit = defineEmits<{
    (e: 'select', id: string): void
}>()

const { data: popularAvatars } = await useFetch('/api/items/popular-avatars', {
    key: 'popular-avatars',
    default: () => [],
})
</script>

<template>
    <div class="flex flex-col gap-6">
        <div class="flex items-center gap-2">
            <Icon name="lucide:person-standing" size="22" class="text-muted" />
            <h2 class="text-xl leading-none font-semibold text-nowrap">人気のアバターから検索</h2>
        </div>

        <div class="flex flex-wrap items-center justify-center gap-5">
            <button
                v-for="(avatar, index) in popularAvatars"
                :key="`avatar-${index}`"
                :aria-label="`Search for ${avatar.name}`"
                class="group relative size-32 cursor-pointer overflow-hidden rounded-lg"
                @click="emit('select', avatar.id)"
            >
                <div
                    class="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
                >
                    <span class="p-1 text-center text-sm font-semibold text-white">
                        {{ avatar.niceName || avatarShortName(avatar.name) }}
                    </span>
                </div>

                <NuxtImg
                    v-slot="{ src, isLoaded, imgAttrs }"
                    :src="avatar.image || undefined"
                    :alt="avatar.name"
                    :width="256"
                    :height="256"
                    format="webp"
                    fit="cover"
                    loading="lazy"
                    fetchpriority="low"
                    custom
                    class="aspect-square shrink-0 rounded-lg object-cover"
                >
                    <img v-if="isLoaded" v-bind="imgAttrs" :src="src" />
                    <USkeleton v-else class="aspect-square shrink-0 rounded-lg object-cover" />
                </NuxtImg>
            </button>
        </div>
    </div>
</template>
