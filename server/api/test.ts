import { serverSupabaseClient } from '#supabase/server';
import { Client, GatewayIntentBits } from 'discord.js';

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig();

    // Supabaseクライアント初期化
    const supabase = await serverSupabaseClient<Database>(event);

    // 日付設定
    const now: Date = new Date();
    const yesterday: Date = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Supabaseからデータ取得
    const { data: feedbackData, error: feedbackError } = await supabase
        .from('feedback')
        .select('*')
        .neq('dealt', true)
        .lt('created_at', now.toISOString())
        .gt('created_at', yesterday.toISOString());

    const { data: reportSetupData, error: reportSetupError } = await supabase
        .from('report_setup')
        .select('*')
        .neq('dealt', true)
        .lt('created_at', now.toISOString())
        .gt('created_at', yesterday.toISOString());

    const { data: reportUserData, error: reportUserError } = await supabase
        .from('report_user')
        .select('*')
        .neq('dealt', true)
        .lt('created_at', now.toISOString())
        .gt('created_at', yesterday.toISOString());

    // レスポンスデータの構成
    const response = {
        feedback: {
            number: feedbackData ? feedbackData.length : 0,
            error: feedbackError,
        },
        report: {
            setup: {
                number: reportSetupData ? reportSetupData.length : 0,
                error: reportSetupError,
            },
            user: {
                number: reportUserData ? reportUserData.length : 0,
                error: reportUserError,
            },
        },
    };

    // メッセージ内容の作成
    const contents: string[] = [];

    if (response.feedback.error)
        contents.push('1. 取得に失敗 : フィードバック');
    if (response.feedback.number !== 0)
        contents.push(
            `1. 送信されたフィードバック: **${response.feedback.number}**`
        );

    if (response.report.setup.error)
        contents.push('2. 取得に失敗 : セットアップ報告');
    if (response.report.setup.number !== 0)
        contents.push(
            `2. 送信されたセットアップ報告: **${response.report.setup.number}**`
        );

    if (response.report.user.error)
        contents.push('3. 取得に失敗 : ユーザー報告');
    if (response.report.user.number !== 0)
        contents.push(
            `3. 送信されたユーザー報告: **${response.report.user.number}**`
        );

    const message =
        '**Avatio**\n\n' +
        'この24時間のレポート\n' +
        `${yesterday.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} -> ${now.toLocaleString(
            'ja-JP',
            { timeZone: 'Asia/Tokyo' }
        )}\n\n` +
        contents.join('\n');

    // Discordにメッセージ送信
    if (contents.length) {
        const client = new Client({
            intents: [GatewayIntentBits.Guilds],
        });

        try {
            await client.login(config.discord.botToken);

            const channel = await client.channels.fetch(
                config.discord.channelId
            );
            if (channel?.isTextBased() && 'send' in channel) {
                await channel.send({ content: message });
            } else {
                throw new Error(
                    'チャンネルが見つからないかテキストチャンネルではありません'
                );
            }

            // 接続を閉じる
            client.destroy();
        } catch (error) {
            console.error('Discord送信エラー:', error);
            return {
                statusCode: 500,
                body: { error: 'Discordへのメッセージ送信に失敗しました' },
            };
        }
    }

    return { message: 'メッセージを正常に送信しました' };
});
