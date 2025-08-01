<script lang="ts" setup>
interface Props {
    itemId: string
}
const props = defineProps<Props>()

const emit = defineEmits<{
    (e: 'remove', itemId: string): void
}>()

const { data: item } = useFetch<Item>(`/api/items/${props.itemId}`, {
    immediate: true,
})
</script>

<template>
    <div class="bg-accented flex max-w-56 items-center gap-2 rounded-lg p-2">
        <template v-if="item">
            <NuxtImg
                v-slot="{ isLoaded, src, imgAttrs }"
                :src="item.image || undefined"
                :alt="item.name"
                :height="36"
                :width="36"
                format="webp"
                loading="lazy"
                custom
                class="aspect-square size-9 shrink-0 rounded-lg object-cover"
            >
                <img v-if="isLoaded" v-bind="imgAttrs" :src="src" />
                <USkeleton
                    v-else
                    class="aspect-square size-9 shrink-0 rounded-lg"
                />
            </NuxtImg>

            <p class="line-clamp-2 text-xs">
                {{ item.name }}
            </p>

            <UButton
                icon="lucide:x"
                variant="ghost"
                size="sm"
                :aria-label="`${item.name} を削除`"
                @click="emit('remove', props.itemId)"
            />
        </template>

        <div v-else class="flex w-24 justify-start p-2">
            <Icon
                name="svg-spinners:ring-resize"
                size="20"
                class="text-dimmed shrink-0"
            />
        </div>
    </div>
</template>
