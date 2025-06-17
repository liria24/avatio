<script lang="ts" setup>
const route = useRoute()
const setup = await $fetch(`/api/setup/${route.params.id}`)
</script>

<template>
    <div>{{ setup }}</div>
</template>
