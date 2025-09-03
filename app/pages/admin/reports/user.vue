<script setup lang="ts">
definePageMeta({
    middleware: 'admin',
    layout: 'dashboard',
})
</script>

<template>
    <UDashboardPanel id="reports-user">
        <template #header>
            <UDashboardNavbar title="Reports | User" />
        </template>

        <template #body> </template>
    </UDashboardPanel>
</template>
