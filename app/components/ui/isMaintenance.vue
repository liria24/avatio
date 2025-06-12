<script lang="ts" setup>
const isMaintenance = ref<boolean>(false)

onMounted(async () => {
    const res = await $fetch('/api/edge-config')
    if (res.value) isMaintenance.value = res.isMaintenance as boolean
})
</script>

<template>
    <div v-if="isMaintenance" class="leading-none">Maintenance now</div>
</template>
