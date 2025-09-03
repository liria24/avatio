<script setup lang="ts">
definePageMeta({
    middleware: 'admin',
    layout: 'dashboard',
})
</script>

<template>
    <UDashboardPanel id="items">
        <template #header>
            <UDashboardNavbar title="Items" />
        </template>

        <template #body> </template>
    </UDashboardPanel>
</template>
