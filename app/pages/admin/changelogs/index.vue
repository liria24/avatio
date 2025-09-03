<script setup lang="ts">
definePageMeta({
    middleware: 'admin',
    layout: 'dashboard',
})
</script>

<template>
    <UDashboardPanel id="changelogs">
        <template #header>
            <UDashboardNavbar title="Changelogs" />
        </template>

        <template #body> </template>
    </UDashboardPanel>
</template>
