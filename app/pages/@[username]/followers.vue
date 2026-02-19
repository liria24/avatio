<script setup lang="ts">
const route = useRoute()

const username = route.params.username as string

const { data: user } = await useUser(username)
const { data } = await useUserFollowers(username)

defineSeo({
    title: `${user.value?.name}さんのフォロワー`,
    image: user.value?.image || undefined,
})
</script>

<template>
    <div>
        <pre>{{ data }}</pre>
    </div>
</template>
