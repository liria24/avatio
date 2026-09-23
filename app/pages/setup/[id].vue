<script setup lang="ts">
const id = useRouteParams('id', undefined, { transform: String })
const route = useRoute()
const canonicalPath = id.value ? useSetupPath()(id.value) : ''

if (!id.value) throw showError({ status: 400 })
if (route.path !== canonicalPath)
    await navigateTo(
        { path: canonicalPath, query: route.query },
        { redirectCode: 308, replace: true },
    )
</script>

<template>
    <SetupsDetail v-if="route.path === canonicalPath" />
</template>
