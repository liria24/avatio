<script setup lang="ts">
definePageMeta({
    middleware: 'admin',
    layout: 'dashboard',
})
</script>

<template>
    <UDashboardPanel id="setups">
        <template #header>
            <UDashboardNavbar title="Setups" />
        </template>

        <template #body> </template>
    </UDashboardPanel>
</template>
