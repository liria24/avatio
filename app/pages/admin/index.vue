<script lang="ts" setup>
definePageMeta({
    middleware: 'admin',
})
</script>

<template>
    <div class="flex w-full flex-col gap-6">
        <h1 class="font-[Geist] text-3xl text-nowrap">Admin Console</h1>

        <AdminUsers />

        <AdminFeedbacks />

        <UCard>
            <template #header>
                <div class="flex items-center justify-between gap-3">
                    <h2 class="text-xl font-semibold text-nowrap">変更履歴</h2>
                    <UButton
                        to="/admin/changelogs/compose"
                        icon="lucide:plus"
                        label="追加"
                        color="neutral"
                    />
                </div>
            </template>
        </UCard>

        <AdminAuditLog />

        <AdminManage />
    </div>
</template>
