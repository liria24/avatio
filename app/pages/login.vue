<script setup lang="ts">
const user = useSupabaseUser()
if (user.value) navigateTo('/')

defineSeo({
    title: 'ログイン',
})
</script>

<template>
    <div class="my-10 flex w-full flex-col items-center gap-5">
        <UiLogin />
        <UButton
            to="/"
            label="ホームに戻る"
            icon="lucide:arrow-left"
            variant="ghost"
        />
    </div>
</template>
