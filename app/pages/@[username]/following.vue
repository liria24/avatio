<script setup lang="ts">
const route = useRoute()

const { data } = await useUserFollowing(route.params.username as string)
</script>

<template>
    <div>
        <pre>{{ data }}</pre>
    </div>
</template>
