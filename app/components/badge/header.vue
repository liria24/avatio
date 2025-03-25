<script lang="ts" setup>
const badge = ref<HeaderBadge | null>(null);

try {
    const res = await $fetch('/api/edge-config/badgeMain');
    badge.value = res.value ? (res.value as unknown as HeaderBadge) : null;
} catch (error) {
    console.error('Failed to fetch badge:', error);
    badge.value = null;
}
</script>

<template>
    <Button
        v-if="badge"
        :to="badge.link"
        :label="badge.label"
        variant="outline"
        class="rounded-full py-2 text-xs"
    />
</template>
