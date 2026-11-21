import type { SetupComposeForm, SetupDraftContent } from '@avatio/core/setups'

import type { Setup, SetupImageMetadata } from '../../shared/types/database'

export const buildDraftImageMetadata = (
    content: SetupDraftContent,
): Record<string, SetupImageMetadata> =>
    Object.fromEntries(
        content.images.map((url) => [
            url,
            {
                ...content.imageMetadata?.[url],
                id: content.imageMetadata?.[url]?.id ?? crypto.randomUUID(),
            },
        ]),
    ) as Record<string, SetupImageMetadata>

export const normalizeDraftFormValues = (content: SetupDraftContent): SetupComposeForm => {
    const { imageMetadata: _, ...formValues } = content
    return {
        ...formValues,
        items: formValues.items.map((entry) => ({
            ...entry,
            id: entry.id ?? crypto.randomUUID(),
        })),
        points: formValues.points ?? [],
    }
}

export const mapSetupToDraftContent = (setup: Setup): SetupDraftContent => ({
    public: setup.public,
    name: setup.name,
    description: setup.description ?? '',
    images: setup.images?.map(({ url }) => url) ?? [],
    tags: setup.tags ?? [],
    coauthors:
        setup.coauthors?.map(({ user, note }) => ({
            userId: user.id,
            username: user.username,
            note: note ?? '',
        })) ?? [],
    items: setup.entries.map((item) => ({
        id: item.id,
        itemId: item.catalogItem.id,
        category: item.category,
        note: item.note ?? '',
        unsupported: item.unsupported ?? false,
        shapekeys: item.shapekeys ?? [],
    })),
    points: setup.points ?? [],
    imageMetadata: Object.fromEntries(
        (setup.images ?? []).map((image) => [
            image.url,
            {
                id: image.id,
                objectKey: image.objectKey,
                contentType: image.contentType ?? undefined,
                size: image.size ?? undefined,
                etag: image.etag ?? undefined,
                width: image.width,
                height: image.height,
                themeColors: image.themeColors ?? null,
            },
        ]),
    ),
})

export const buildSetupPublishPayload = (
    values: SetupComposeForm,
    imageMetadata: Record<string, SetupImageMetadata> | undefined,
    includeItemPoints: boolean,
) => ({
    public: values.public,
    name: values.name,
    description: values.description,
    items: values.items,
    images: values.images,
    imageMetadata,
    ...(includeItemPoints && { points: values.points }),
    tags: values.tags.map((tag) => ({ tag })),
    coauthors: values.coauthors.map(({ userId, note }) => ({
        userId,
        note: note || undefined,
    })),
})
