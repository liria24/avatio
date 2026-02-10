<script setup lang="ts">
import type { CommandPaletteItem } from '@nuxt/ui'

const emit = defineEmits<{
    select: [user: SerializedUser]
}>()

const open = defineModel<boolean>({
    default: false,
})

const toast = useToast()
const { t } = useI18n()

const searchTerm = ref('')

const { data: users, status } = useFetch('/api/users', {
    dedupe: 'defer',
    default: () => [],
    getCachedData: (key, nuxtApp, ctx) =>
        ctx.cause === 'refresh:manual'
            ? undefined
            : nuxtApp.payload.data[key] || nuxtApp.static.data[key],
})

const existingUsersGroup = computed(() => ({
    id: 'existing-users',
    label: t('commandPalette.userSearch.users'),
    items: users.value.map((user, index) => ({
        id: `existing-${index}`,
        label: user.name,
        avatar: { src: user.image || undefined },
        onSelect: () => onSelect(user.username),
    })) satisfies CommandPaletteItem[],
}))

const userFromIdGroup = computed(() => ({
    id: 'user-from-id',
    label: t('commandPalette.userSearch.addFromId'),
    items: [
        {
            id: 'user-from-id-item',
            label: searchTerm.value,
            onSelect: () => onSelect(searchTerm.value),
        },
    ] satisfies CommandPaletteItem[],
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

const onSelect = async (username: string) => {
    try {
        const user = await $fetch<SerializedUser>(`/api/users/${username}`)
        emit('select', {
            id: user.id,
            username: user.username,
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
            title: t('commandPalette.userSearch.userNotFound'),
            description: t('commandPalette.userSearch.userNotFoundDescription'),
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
        virtualize
        selection-behavior="replace"
        :loading="status === 'pending'"
        :placeholder="$t('commandPalette.userSearch.placeholder')"
        :groups="groups"
        :ui="{
            input: '[&>input]:text-sm',
        }"
        class="max-h-80"
    />
</template>
