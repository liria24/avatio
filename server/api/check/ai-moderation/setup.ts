// import { generateObject } from 'ai';
// import { createOpenAI } from '@ai-sdk/openai';
// import { z } from 'zod';

export default defineEventHandler(async (event) => {
    // 精度とコストに難があるためまだ運用しません
    return null;

    const { id } = await getQuery<{ id: number }>(event);

    const { data } = await event.$fetch('/api/setup', {
        query: { id },
    });

    if (!data) return null;

    const setupData = {
        id: data.id,
        title: data.name,
        description: data.description,
        userName: data.author.name,
        tags: data.tags,
        unityVersion: data.unity,
        items: Object.values(data.items)
            .flat()
            .map((item) => {
                return {
                    shapekeys: item.shapekeys.map((shapekey) => shapekey.name),
                    note: item.note,
                };
            }),
    };

    const content = [
        {
            type: 'text',
            text: JSON.stringify(setupData).toString().replace(/\s+/g, ' '),
        },
        ...data.images.map((image) => ({
            type: 'image',
            image: new URL(`https://images.avatio.me/setup/${image.name}`),
        })),
    ];

    const system = `
        あなたはwebサービスの投稿データをパトロールするAIです
        このサービスは、VRSNSで使用するアバターに使われる販売アセットをまとめて投稿するものです
        提供された内容を解析して、投稿に問題があるか判断してください

        # 問題のある投稿の例

        - 他人を不快にする可能性のある言葉遣いが含まれる
        - VRSNSアバターを共有するサービスにも関わらず、関係のない画像（風景のみや実写画像など）が含まれている
        - 局部を露出している画像が含まれている

        # 投稿データ

        ## JSON
        {
            id: number, // 投稿のID
            title: string, // 投稿のタイトル
            description: string, // 投稿の説明
            userName: string, // 投稿者の名前
            tags: string[], // 投稿のタグ
            unityVersion: string, // 投稿データのUnityバージョン番号
            items: {
                shapekeys: string[], // 投稿に登録されたアイテムのシェイプキー名称
                note: string, // 投稿に登録されたアイテムの付加ノート
            }[] // 投稿に含まれるアイテムの情報
        }

        ## 画像
        - 添付された画像です

        # レスポンス内容

        - severity: 問題の深刻度を表す文字列です
        - category: 問題のカテゴリを表す文字列です
        - reason: 何故問題があると判定したのか、理由を具体的に表現してください

        # 注意

        - 日本語で出力してください
        - severityが高いもののみを出力してください
        - 投稿に問題がない場合、issuesは空配列を返してください
    `;

    const runtime = useRuntimeConfig();

    const openai = createOpenAI({
        apiKey: runtime.openai.apiKey,
        compatibility: 'strict',
    });

    try {
        const { object } = await generateObject({
            model: openai('gpt-4o-mini', { structuredOutputs: true }),
            schema: z.object({
                issues: z.array(
                    z.object({
                        severity: z.string(),
                        category: z.string(),
                        reason: z.string(),
                    })
                ),
            }),
            system: system.trim().replace(/\s+/g, ' '),
            messages: [
                {
                    role: 'user',
                    content: content as never,
                },
            ],
        });
        return object;
    } catch (error) {
        console.error(error);
        return null;
    }
});
