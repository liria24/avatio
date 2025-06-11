<script lang="ts" setup>
const username = defineModel<string>({
    default: '',
})

const props = defineProps<{
    class?: string | string[]
}>()
</script>

<template>
    <UiTextinput
        v-model="username"
        placeholder="ユーザー名"
        :class="props.class"
    />
</template>
