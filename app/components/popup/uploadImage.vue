<script setup lang="ts">
const types = ['PNG', 'JPEG', 'WebP', 'TIFF']
</script>

<template>
    <Popup>
        <template #trigger>
            <slot />
        </template>

        <template #content>
            <div class="flex flex-col gap-1.5">
                <p class="text-sm font-bold text-zinc-600 dark:text-zinc-200">
                    対応形式
                </p>
                <div class="flex flex-wrap items-center gap-1">
                    <UiBadge v-for="i in types" :key="useId()">
                        {{ i }}
                    </UiBadge>
                </div>
            </div>
            <div class="flex flex-col gap-1.5 text-zinc-600 dark:text-zinc-400">
                <p class="text-sm/relaxed">
                    アップロードされた画像は、自動的に下記の仕様でJPEG圧縮されます。<br />
                    非営利運営に必要な処置になりますのでご了承ください。
                </p>
                <p class="text-sm/relaxed">
                    最大長辺解像度 1920px<br />最大ファイルサイズ 1.5MB
                </p>
            </div>
        </template>
    </Popup>
</template>
