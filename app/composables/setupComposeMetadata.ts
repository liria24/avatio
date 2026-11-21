import type { SetupComposeForm } from '@avatio/core/setups'
import { computed, type Ref } from 'vue'

import type { User } from '../../shared/types/database'

export type ComposeUser = Pick<User, 'id' | 'username' | 'name' | 'image'>
export type ComposeCoauthor = SetupComposeForm['coauthors'][number] & { user: ComposeUser }

interface SetupComposeMetadataOptions {
    values: Readonly<Ref<SetupComposeForm>>
    userEntities: Ref<Record<string, ComposeUser>>
    setTags: (tags: SetupComposeForm['tags']) => void
    setCoauthors: (coauthors: SetupComposeForm['coauthors']) => void
}

export const useSetupComposeMetadata = ({
    values,
    userEntities,
    setTags,
    setCoauthors: updateCoauthorsField,
}: SetupComposeMetadataOptions) => {
    const toast = useToast()
    const { t } = useI18n()

    const coauthors = computed<ComposeCoauthor[]>(() =>
        values.value.coauthors.map((coauthor) => ({
            ...coauthor,
            user: userEntities.value[coauthor.userId] ?? {
                id: coauthor.userId,
                username: coauthor.username,
                name: coauthor.username,
                image: null,
            },
        })),
    )

    const addTag = (tag: string) => {
        const normalized = tag.trim().slice(0, 32)
        if (!normalized || values.value.tags.length >= 8) return
        if (values.value.tags.includes(normalized)) {
            toast.add({
                id: 'tag-duplicate',
                icon: 'mingcute:close-line',
                title: t('setup.compose.tagDuplicate'),
                color: 'warning',
            })
            return
        }
        setTags([...values.value.tags, normalized])
    }

    const removeTag = (tag: string) =>
        setTags(values.value.tags.filter((candidate) => candidate !== tag))

    const addCoauthor = (user: ComposeUser) => {
        if (!user?.username || values.value.coauthors.some(({ userId }) => userId === user.id))
            return
        userEntities.value = { ...userEntities.value, [user.id]: user }
        updateCoauthorsField([
            ...values.value.coauthors,
            { userId: user.id, username: user.username, note: '' },
        ])
    }

    const removeCoauthor = (userId: string) =>
        updateCoauthorsField(
            values.value.coauthors.filter((coauthor) => coauthor.userId !== userId),
        )

    const setCoauthors = (next: ComposeCoauthor[]) =>
        updateCoauthorsField(next.map(({ userId, username, note }) => ({ userId, username, note })))

    const updateCoauthorNote = (userId: string, note: string) =>
        updateCoauthorsField(
            values.value.coauthors.map((coauthor) =>
                coauthor.userId === userId ? { ...coauthor, note } : coauthor,
            ),
        )

    return {
        coauthors,
        addTag,
        removeTag,
        addCoauthor,
        removeCoauthor,
        setCoauthors,
        updateCoauthorNote,
    }
}
