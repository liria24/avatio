import * as v from 'valibot'

export const avatioImagePropsSchema = v.object({
    title: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
    description: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(240))),
})

export type AvatioImageProps = v.InferOutput<typeof avatioImagePropsSchema>

export const ogImageDescriptorSchema = v.object({
    preset: v.literal('avatio'),
    version: v.literal('v1'),
    props: avatioImagePropsSchema,
})

export type OgImageDescriptor = v.InferOutput<typeof ogImageDescriptorSchema>

export const issueAvatioImageRequestSchema = v.object({
    secret: v.string(),
    props: avatioImagePropsSchema,
})

export type IssueAvatioImageRequest = v.InferOutput<typeof issueAvatioImageRequestSchema>

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
