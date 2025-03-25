import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

export default defineEventHandler(async (event) => {
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
        images: data.images.map(
            (image) => `https://images.avatio.me/setup/${image.name}`
        ),
        items: Object.values(data.items)
            .flat()
            .map((item) => {
                return {
                    shapekeys: item.shapekeys.map((shapekey) => shapekey.name),
                    note: item.note,
                };
            }),
    };

    const system = `
        あなたはwebサービスの投稿データをパトロールするAIです
        このサービスは、VRSNSで使用するアバターに使われる販売アセットをまとめて投稿するものです
        提供された内容を解析して、投稿に問題があるか判断してください

        # 投稿データのスキーマ

        {
            id: number, // 投稿のID
            title: string, // 投稿のタイトル
            description: string, // 投稿の説明
            userName: string, // 投稿者の名前
            tags: string[], // 投稿のタグ
            unityVersion: string, // 投稿データのUnityバージョン番号
            images: string[], // 投稿に含まれる画像のファイル名
            items: {
                shapekeys: string[], // 投稿に登録されたアイテムのシェイプキー名称
                note: string, // 投稿に登録されたアイテムの付加ノート
            }[] // 投稿に含まれるアイテムの情報
        }

        # レスポンス内容

        - id: 投稿のIDを記入してください
        - issues: 投稿の問題点を問題の数だけ記入してください
            - severity: 問題の深刻度を表す文字列です
            - category: 問題のカテゴリを表す文字列です
            - reason: 何故問題があると判定したのか、理由を具体的に表現してください

        # 問題があるかどうかの判定要素

        - スパム・荒らし目的
        - 過度に性的・暴力的な内容

        - 画像が使われていないことは問題ではありません
        - 説明文が未記入であることは問題ではありません
        - タグが未記入であることは問題ではありません
        - シェイプキーのリストが空であることは問題ではありません
        - アイテムのノートが未記入であることは問題ではありません
        - Unityバージョンが未指定であることは問題ではありません

        # 注意

        - 日本語で出力してください
        - 明らかに内容に違和感のあるもののみを報告してください
        - 投稿に問題がない場合、issuesは空配列を返してください
    `;

    const runtime = useRuntimeConfig();

    const openai = createOpenAI({
        apiKey: runtime.openai.apiKey,
        compatibility: 'strict',
    });

    try {
        const { object } = await generateObject({
            model: openai('o3-mini', { structuredOutputs: true }),
            schema: z.object({
                id: z.number(),
                issues: z.array(
                    z.object({
                        severity: z.string(),
                        category: z.string(),
                        reason: z.string(),
                    })
                ),
            }),
            system: system.trim().replace(/\s+/g, ' '),
            prompt: JSON.stringify(setupData).replace(/\s+/g, ' '),
        });
        return object;
    } catch (error) {
        console.error(error);
        return null;
    }
});
