<script lang="ts" setup>
interface Props {
    id: string
    name: string
    avatar?: string | null
}
const props = defineProps<Props>()

const emit = defineEmits(['remove', 'update:note'])

const note = defineModel<string>('note', {
    required: true,
    default: '',
})
</script>

<template>
    <div
        class="flex flex-col gap-1.5 rounded-lg p-2 ring-1 ring-zinc-400 dark:ring-zinc-700"
    >
        <div class="flex items-center gap-1.5">
            <UiAvatar
                :url="getImage(props.avatar, { prefix: 'avatar' })"
                alt="co-author"
                class="size-9"
            />
            <span class="grow text-sm leading-none">{{ props.name }}</span>
            <Button variant="flat" class="p-2" @click="emit('remove')">
                <Icon name="lucide:x" size="16" />
            </Button>
        </div>
        <UiTextinput v-model="note" placeholder="ノート">
            <template #trailing>
                <UiCount v-if="note.length" :count="note.length" :max="64" />
            </template>
        </UiTextinput>
    </div>
</template>
