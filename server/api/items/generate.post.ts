import { itemCategory } from '@@/database/schema'
import { generateObject } from 'ai'
import { z } from 'zod'

const body = z.object({
    name: z.string().min(1),
    description: z
        .union([
            z.string().min(1),
            z.object({
                description: z.string(),
                readme: z.string(),
            }),
        ])
        .optional(),
    category: z.string().min(1).optional(),
})

const system = `
EC サイトや GitHub で配布されているデジタル商品の情報から、以下の情報を抽出してください。

{
    niceName: アイテム名称。固有名詞のみを抽出してください。
    category: アイテムのカテゴリー。名前と説明から最も適切なカテゴリーを 1 つ選んでください。
}

## アイテム名称の抽出方法

- 商品名と商品情報を読み、アイテム名と思われる部分のみを抽出します。
- カテゴリー表記などは除去してください。
- 【】のように囲まれた部分は不要な場合が多いです。

## カテゴリの判定方法

1. アイテムの名前と説明をもとに、最も適切なカテゴリを選択します。
2. アイテムの名前と説明からカテゴリが明確に判断できない場合は、originalCategory を参照してください。
3. カテゴリは以下から選択してください。
    - ${itemCategory.enumValues.join(', ')}

## 注意
- niceName は、大文字小文字やひらがなカタカナを確実に維持してください。
- 出力は結果のみとしてください。
`

const previousItemsMessage = (
    previousItems: { name: string; niceName: string | null; category: string }[]
) => `
以下のアイテムが既に存在します。

${previousItems.map((item) => `${item.name}: ${item.niceName} [${item.category}]`).join('\n')}

これらの情報を参考にしてください。
`

export default defineApi(
    async () => {
        const { name, description, category } = await validateBody(body)

        const previousItems = await db.query.items.findMany({
            where: {
                niceName: { isNotNull: true },
            },
            columns: {
                name: true,
                niceName: true,
                category: true,
            },
            limit: 32,
        })

        const messages = [
            {
                role: 'user' as const,
                content: previousItemsMessage(previousItems),
            },
            {
                role: 'user' as const,
                content: JSON.stringify({
                    name,
                    description,
                    originalCategory: category,
                }),
            },
        ]

        const result = await generateObject({
            model: 'google/gemini-3-flash',
            system,
            messages,
            schema: z.object({
                niceName: z.string().min(1),
                category: itemCategorySchema,
            }),
        })

        return {
            ...result.object,
            niceName: result.object.niceName.replace('　', ' ').trim(),
        }
    },
    {
        errorMessage: 'Failed to extract item information.',
        requireAdmin: true,
    }
)
