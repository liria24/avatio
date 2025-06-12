<script lang="ts" setup>
const bio = defineModel<string>({
    default: '',
})
</script>

<template>
    <UiTextarea
        v-model="bio"
        placeholder="簡単な自己紹介をしてみましょう"
        class="w-full p-3"
    />
</template>
