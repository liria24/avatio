<script setup lang="ts">
withDefaults(
    defineProps<{
        image?: string | null;
        positionX?: number;
        positionY?: number;
        cropWidthPercent?: number;
    }>(),
    {
        image: null,
        positionX: 50,
        positionY: 50,
        cropWidthPercent: 100,
    }
);
</script>

<template>
    <div class="relative size-full bg-zinc-900 text-zinc-50">
        <div
            v-if="image"
            class="absolute inset-0 h-full w-full object-cover"
            :style="{
                backgroundImage: `url(http://localhost:3000/api/ogImageCrop/${image}?crop=${positionX},${positionY},${cropWidthPercent})`,
                backgroundSize: 'cover',
                backgroundAttachment: 'fixed',
                backgroundRepeat: 'no-repeat',
            }"
        />
        <div class="absolute bottom-0 left-0 right-0">
            <div
                class="h-40 w-full"
                :style="{
                    backgroundImage:
                        'linear-gradient(to top, rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0))',
                }"
            />
        </div>
        <div class="absolute bottom-0 left-0 p-8">
            <Icon name="avatio:avatio" mode="svg" class="size-16" />
        </div>
    </div>
</template>
