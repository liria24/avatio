import * as v from 'valibot'

export const ogImageDescriptorBaseSchema = v.object({
    preset: v.string(),
    version: v.string(),
    props: v.unknown(),
})

export type OgImageDescriptor = v.InferOutput<typeof ogImageDescriptorBaseSchema>

export const issueImageRequestBaseSchema = v.object({
    secret: v.string(),
    props: v.unknown(),
})

export interface IssueImageResponse {
    url: string
}

export interface OgImageEnv {
    OG_IMAGE_SECRET?: string
}

export type WaitUntil = (promise: Promise<unknown>) => void

export interface WorkerExecutionContext {
    waitUntil: WaitUntil
}
