import { z } from 'zod'

import { itemCategorySchema } from '../../catalog/domain/category'

const shapekeySchema = z.object({
    name: z.string().min(1).max(64),
    value: z.number(),
})

export const setupDraftImageMetadataSchema = z.object({
    id: z.string().min(1).optional(),
    objectKey: z.string().min(1),
    contentType: z.string().optional(),
    size: z.number().int().min(1).optional(),
    etag: z.string().nullable().optional(),
    width: z.number().int().min(1).max(8192),
    height: z.number().int().min(1).max(8192),
    themeColors: z
        .string()
        .regex(/^#[\da-f]{6}$/i)
        .array()
        .max(8)
        .nullable()
        .optional(),
})

const setupPointSchema = z.object({
    id: z.string().min(1),
    imageId: z.string().min(1),
    entryId: z.string().min(1),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
})

export const setupComposeFormSchema = z.object({
    public: z.boolean(),
    name: z.string().max(64),
    description: z.string().max(512),
    images: z.url().array().max(4),
    tags: z.string().min(1).max(32).array().max(8),
    coauthors: z
        .object({
            userId: z.string().min(1),
            username: z.string().min(1),
            note: z.string().max(140),
        })
        .array()
        .max(8),
    items: z
        .object({
            id: z.string().min(1).optional(),
            itemId: z.string().min(1),
            category: itemCategorySchema,
            note: z.string().max(300),
            unsupported: z.boolean(),
            shapekeys: shapekeySchema.array().max(64),
        })
        .array(),
    points: setupPointSchema.array().max(128),
})

export const setupDraftContentSchema = setupComposeFormSchema.extend({
    points: setupPointSchema.array().max(128).default([]),
    imageMetadata: z.record(z.string(), setupDraftImageMetadataSchema).optional(),
})

export type SetupComposeForm = z.infer<typeof setupComposeFormSchema>
export type SetupDraftContent = z.infer<typeof setupDraftContentSchema>

export const createDefaultSetupComposeForm = (): SetupComposeForm => ({
    public: true,
    name: '',
    description: '',
    images: [],
    tags: [],
    coauthors: [],
    items: [],
    points: [],
})

export const isEmptySetupComposeForm = (form: SetupComposeForm) =>
    form.public &&
    !form.name.trim() &&
    !form.description.trim() &&
    !form.images.length &&
    !form.tags.length &&
    !form.coauthors.length &&
    !form.items.length &&
    !form.points.length
