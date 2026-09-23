import { createWorkersAiCapabilities } from '@avatio/cloudflare'
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
            .mockResolvedValueOnce(
                response(JSON.stringify({ displayName: 'Avatar', category: 'avatar' })),
            )
            .mockResolvedValueOnce(response(JSON.stringify({ title: 'Title', content: 'Content' })))
            .mockResolvedValueOnce(response('new-release'))
        const capabilities = createWorkersAiCapabilities({
            binding: { run } as unknown as Parameters<
                typeof createWorkersAiCapabilities
            >[0]['binding'],
            models: {
                catalogEnrichment: 'openai/gpt-5.6-luna',
                changelogTranslation: 'openai/gpt-5.6-luna',
                changelogSlug: 'openai/gpt-5.6-luna',
            },
            itemCategories: ['avatar', 'other'],
        })
        expect(
            await capabilities.catalogItemEnricher.enrich({ sourceId: 'source', name: 'Avatar' }),
        ).toEqual({ displayName: 'Avatar', category: 'avatar' })
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
        for (const [model, input, options] of run.mock.calls) {
            expect(model).toBe('openai/gpt-5.6-luna')
            expect(input.input).toEqual(expect.any(Array))
            expect(input).not.toHaveProperty('messages')
            expect(options.returnRawResponse).toBe(true)
        }
    })
})
