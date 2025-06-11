<script lang="ts" setup>
definePageMeta({
    layout: 'blank',
})
</script>

<template>
    <div class="my-24 flex w-full flex-col items-center gap-6">
        <LogoAvatio class="mb-24 w-64" aria-label="Avatio" />
        <h1
            class="flex font-['Montserrat'] text-7xl font-extrabold text-zinc-500 dark:text-zinc-400"
        >
            503
        </h1>
        <p class="text-xl font-bold text-zinc-500 dark:text-zinc-400">
            メンテナンス中
        </p>
        <p
            class="text-center text-sm font-bold text-zinc-500 dark:text-zinc-400"
        >
            ご迷惑をおかけしますが、時間をおいて再度お試しください
        </p>
    </div>
</template>
