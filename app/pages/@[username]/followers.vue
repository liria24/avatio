<script setup lang="ts">
const route = useRoute()

const username = route.params.username as string

const { data } = await useUserFollowers(username)

defineSeo({
    title: `${data.value?.user.name}さんのフォロワー`,
    image: data.value?.user.image || undefined,
})
</script>

<template>
    <div>
        <pre>{{ data }}</pre>
    </div>
</template>
