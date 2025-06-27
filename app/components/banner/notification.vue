<script lang="ts" setup>
const visible = ref(true)

const onClick = () => {
    visible.value = false
}
</script>

<template>
    <div
        v-if="visible"
        class="ring-accented flex items-center gap-3 rounded-lg p-1.5 ring-1"
    >
        <p
            class="text-toned grow pl-2 text-xs wrap-anywhere break-keep"
            v-html="useLineBreak('ユーザーIDを変更できるようになりました！')"
        />

        <UButton
            :to="$localePath('/settings')"
            label="変更する"
            icon="lucide:arrow-right"
            variant="outline"
            size="xs"
        />

        <UButton
            icon="lucide:x"
            variant="ghost"
            size="sm"
            class="place-self-end"
            @click="onClick"
        />
    </div>
</template>
