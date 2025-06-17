<script lang="ts" setup>
const route = useRoute()
const user = await $fetch(`/api/user/${route.params.id}`)
</script>

<template>
    <div>{{ user }}</div>
</template>
