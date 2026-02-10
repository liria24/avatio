<script lang="ts" setup>
interface Props {
    itemId: string
}
const props = defineProps<Props>()

const emit = defineEmits<{
    (e: 'remove', itemId: string): void
}>()

const { data: item } = useFetch<Item>(`/api/items/${transformItemId(props.itemId).encode()}`, {
    immediate: true,
    dedupe: 'defer',
})
</script>

<template>
    <div class="bg-accented flex max-w-56 items-center gap-2 rounded-lg p-2">
        <template v-if="item">
            <NuxtImg
                v-slot="{ isLoaded, src, imgAttrs }"
                :src="item.image || undefined"
                :height="48"
                :width="48"
                format="avif"
                custom
            >
                <img
                    v-if="isLoaded"
                    v-bind="imgAttrs"
                    :src
                    alt=""
                    loading="lazy"
                    fetchpriority="low"
                    class="aspect-square size-9 shrink-0 rounded-lg object-cover"
                />
                <USkeleton v-else class="aspect-square size-9 shrink-0 rounded-lg" />
            </NuxtImg>

            <p class="line-clamp-2 text-xs">
                {{ item.name }}
            </p>

            <UButton
                icon="mingcute:close-line"
                variant="ghost"
                size="sm"
                :aria-label="$t('search.options.removeItem', { name: item.name })"
                @click="emit('remove', props.itemId)"
            />
        </template>

        <div v-else class="flex w-24 justify-start p-2">
            <Icon name="svg-spinners:ring-resize" size="20" class="text-dimmed shrink-0" />
        </div>
    </div>
</template>
