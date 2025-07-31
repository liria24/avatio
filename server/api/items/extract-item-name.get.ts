import { generateText } from 'ai'
import { z } from 'zod'

const query = z.object({
    item: z.string().min(1, 'Item name must be at least 1 character long.'),
})

const system = `
EC サイトで販売されているデジタル商品の商品タイトルから、アイテム名称のみを抽出してください。

- 固有名詞のみを抽出してください。カテゴリー表記などは不要です。
- 大文字小文字やひらがなカタカナは確実に維持してください。
- 出力は結果のみとしてください。
`

export default defineApi(
    async () => {
        const { item } = await validateQuery(query)

        const result = await generateText({
            model: 'google/gemini-2.5-flash',
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
