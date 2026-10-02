import { createCatalogItemClassifier, createWorkersAiCapabilities } from '@avatio/cloudflare'
import { generateText } from 'ai'

import { openaiProvider } from '../../../packages/cloudflare/src/ai/openai-provider'

const response = (text: string) =>
    Response.json({
        id: 'response-1',
        object: 'response',
        created_at: 1,
        model: 'gpt-5.6-luna',
        status: 'completed',
        output: [
            {
                type: 'message',
                id: 'message-1',
                role: 'assistant',
                status: 'completed',
                content: [{ type: 'output_text', text, annotations: [] }],
            },
        ],
        usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
    })

describe('OpenAI provider request transport', () => {
    it('builds a Responses API request at the fetch boundary', async () => {
        const fetch = vi.fn(async () => response('hello'))
        await generateText({
            model: openaiProvider.create({
                modelId: 'gpt-5.6-luna',
                fetch,
                baseURL: 'https://gateway.example/v1',
            }),
            prompt: 'Hello',
            maxRetries: 0,
        })
        const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
        expect(url).toBe('https://gateway.example/v1/responses')
        expect(typeof init.body).toBe('string')
        const body = JSON.parse(init.body as string)
        expect(body.input).toEqual(expect.any(Array))
        expect(body).not.toHaveProperty('messages')
    })

    it('runs all semantic tasks through the Cloudflare binding using Responses wire format', async () => {
        const run = vi
            .fn()
            .mockResolvedValueOnce(response(JSON.stringify({ displayName: 'Avatar' })))
            .mockResolvedValueOnce(response(JSON.stringify({ title: 'Title', content: 'Content' })))
            .mockResolvedValueOnce(response('new-release'))
        const capabilities = createWorkersAiCapabilities({
            binding: { run } as unknown as Parameters<
                typeof createWorkersAiCapabilities
            >[0]['binding'],
            models: {
                catalogEnrichment: 'openai/gpt-5.6-luna',
                changelogTranslation: 'openai/gpt-5.6-translation',
                changelogSlug: 'openai/gpt-5.6-slug',
            },
        })
        expect(await capabilities.catalogDisplayNameGenerator.generate({ name: 'Avatar' })).toBe(
            'Avatar',
        )
        expect(
            await capabilities.changelogTranslator.translate({
                sourceLocale: 'ja',
                targetLocale: 'en',
                title: 'Title',
                content: 'Content',
            }),
        ).toEqual({ title: 'Title', content: 'Content' })
        expect(await capabilities.changelogSlugGenerator.generate({ title: 'Release' })).toBe(
            'new-release',
        )
        expect(run.mock.calls.map(([model]) => model)).toEqual([
            'openai/gpt-5.6-luna',
            'openai/gpt-5.6-translation',
            'openai/gpt-5.6-slug',
        ])
        for (const [, input, options] of run.mock.calls) {
            expect(input.input).toEqual(expect.any(Array))
            expect(input).not.toHaveProperty('messages')
            expect(options.returnRawResponse).toBe(true)
        }
    })

    it('runs Jev through the default AI Gateway and validates its choice response', async () => {
        const run = vi.fn().mockResolvedValue({
            model: 'jev-1.13.0',
            answers: {
                category: {
                    type: 'choice',
                    choice: 'avatar',
                    confidence: 0.91,
                    probabilities: { avatar: 0.91, other: 0.09, unknown: 0 },
                },
            },
        })
        const classifier = createCatalogItemClassifier({
            binding: { run } as unknown as Parameters<
                typeof createCatalogItemClassifier
            >[0]['binding'],
            model: 'typesafe/jev',
            itemCategories: ['avatar', 'other'],
        })
        const signal = new AbortController().signal

        await expect(classifier.classify({ name: 'Avatar' }, { signal })).resolves.toEqual({
            category: 'avatar',
            confidence: 0.91,
            probabilities: { avatar: 0.91, other: 0.09, unknown: 0 },
            model: 'jev-1.13.0',
        })
        expect(run).toHaveBeenCalledWith(
            'typesafe/jev',
            expect.objectContaining({ state: { name: 'Avatar' } }),
            { gateway: { id: 'default' }, signal },
        )
    })
})
