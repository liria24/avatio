import { createGateway } from '@ai-sdk/gateway'
import { generateText } from 'ai'
import { z } from 'zod/v4'

const query = z.object({
    item: z.string().min(1, 'Item name must be at least 1 character long.'),
})

const config = useRuntimeConfig()

const gateway = createGateway({
    apiKey: config.ai.gateway.apiKey,
})

const system = `
EC サイトで販売されているデジタル商品の商品タイトルから、アイテム名称のみを抽出してください。

- アイテム名称に多数の言語表記が存在する場合、「Item / アイテム」のようにしてください。
- 大文字小文字やひらがなカタカナは確実に維持してください。
- 出力は結果のみとしてください。
`

export default defineApi(
    async () => {
        const { item } = await validateQuery(query)

        const result = await generateText({
            model: gateway('openai/gpt-4.1-mini'),
            system,
            prompt: item,
        })

        return result.text.trim()
    },
    {
        errorMessage: 'Failed to extract item name.',
        requireAdmin: true,
    }
)
