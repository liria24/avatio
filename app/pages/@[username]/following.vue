<script setup lang="ts">
const route = useRoute()

const { data } = await useUserFollowees(route.params.username as string)

defineSeo({
    title: `${data.value?.user.name}さんのフォロー`,
    image: data.value?.user.image || undefined,
})
</script>

<template>
    <div>
        <pre>{{ data }}</pre>
    </div>
</template>
