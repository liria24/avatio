<script setup lang="ts">
const emit = defineEmits<{
    select: [user: User]
}>()

const open = defineModel<boolean>({
    default: false,
})

const toast = useToast()

const searchTerm = ref('')

const { data: users, status } = useFetch('/api/users', {
    key: 'user-search',
    default: () => [],
    getCachedData: (key, nuxtApp) =>
        nuxtApp.payload.data[key] || nuxtApp.static.data[key],
})

const existingUsersGroup = computed(() => ({
    id: 'existing-users',
    label: 'ユーザー',
    items: users.value.map((user, index) => ({
        id: `existing-${index}`,
        label: user.name,
        avatar: { src: user.image || undefined },
        onSelect: () => onSelect(user.id),
    })),
}))

const userFromIdGroup = computed(() => ({
    id: 'user-from-id',
    label: 'ID から追加',
    items: [
        {
            id: 'user-from-id-item',
            label: searchTerm.value,
            onSelect: () => onSelect(searchTerm.value),
        },
    ],
}))

const groups = computed(() => {
    const hasSearchTerm = searchTerm.value.trim().length > 0
    const hasExistingUsers = existingUsersGroup.value.items.length > 0

    if (hasSearchTerm) {
        const result = []

        result.push(userFromIdGroup.value)

        if (hasExistingUsers) result.push(existingUsersGroup.value)

        return result
    }

    return hasExistingUsers ? [existingUsersGroup.value] : []
})

const onSelect = async (id: string) => {
    try {
        const user = await $fetch<UserWithSetups>(`/api/users/${id}`)
        emit('select', {
            id: user.id,
            createdAt: user.createdAt,
            name: user.name,
            image: user.image,
            bio: user.bio,
            links: user.links,
        })
        open.value = false
        searchTerm.value = ''
    } catch (error) {
        console.error('User not found:', error)
        toast.add({
            title: 'ユーザーが見つかりません',
            description:
                '入力したIDのユーザーが存在しないか、アクセスできません。',
            color: 'error',
        })
        return
    }
}
</script>

<template>
    <UCommandPalette
        v-model:open="open"
        v-model:search-term="searchTerm"
        :loading="status === 'pending'"
        placeholder="ユーザーを検索 / ID を入力"
        :groups="groups"
        :ui="{
            input: '[&>input]:text-sm',
        }"
        class="max-h-80"
    />
</template>
