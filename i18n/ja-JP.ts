import { MAX_SETUP_DRAFTS } from '../shared/utils/constants'

export default defineI18nLocale(async () => ({
    language: '言語',
    login: 'ログイン',
    theme: 'テーマ',
    system: 'システム',
    light: 'ライト',
    dark: 'ダーク',
    save: '保存',
    delete: '削除',
    cancel: 'キャンセル',
    edit: '編集',
    loading: '読み込み中...',
    more: 'もっと見る',
    submit: '送信',
    back: '戻る',
    confirm: '確認',
    close: '閉じる',
    add: '追加',
    remove: '削除',
    update: '更新',
    publish: '公開',
    continue: '続ける',
    view: '表示',
    report: '報告',
    share: 'シェア',
    unknownAvatar: '不明なベースアバター',

    shareButton: {
        copyLink: 'リンクをコピー',
        copied: 'コピーしました',
        linkCopied: 'リンクがコピーされました',
        linkCopyFailed: 'リンクのコピーに失敗しました',
    },

    jsWarning:
        'このWebサイトはJavaScriptを使用しています。JavaScriptが無効の場合、正しく表示されません。',

    content: {
        fallbackNotice: 'このコンテンツは現在{locale}に対応していません。',
        fallbackDescription: '日本語にフォールバックされています。',
    },

    itemCategory: {
        avatar: 'ベースアバター',
        hair: 'ヘア',
        clothing: '衣装',
        accessory: 'アクセサリー',
        texture: 'テクスチャ',
        shader: 'シェーダー',
        tool: 'ツール',
        other: 'その他',
    },

    header: {
        postSetup: 'セットアップを投稿',
        searchSetup: 'セットアップを検索',
        notifications: '通知',
        userMenu: 'ユーザーメニュー',
        menu: {
            bookmarks: 'ブックマーク',
            settings: '設定',
            feedback: 'フィードバック',
            switchAccount: 'アカウント切替',
            newAccount: '新しいアカウント',
            logout: 'ログアウト',
        },
    },

    bookmarks: {
        title: 'ブックマーク',
        description: 'あなたがブックマークしたセットアップを確認できます。',
        empty: 'ブックマークがありません',
        added: 'ブックマークに追加しました',
        removed: 'ブックマークから削除しました',
    },

    settings: {
        title: 'ユーザー設定',
        description: 'ユーザープロフィールの編集や、アカウントに関する操作を行うことができます。',
        profile: {
            title: 'プロフィール',
            selectImage: '画像を選択',
            moreOptions: 'その他のオプション',
            name: 'ユーザー名',
            bio: 'bio',
            links: 'リンク',
            addLink: 'リンクを追加',
            removeLink: 'リンクを削除',
        },
        shop: {
            title: 'ショップ認証',
            step1: '1. 認証するショップで販売しているアイテムを1つ選定し、URLを入力してください',
            step2: '2. 選定したアイテムの説明文に以下のコードを追記してください',
            stepDescription:
                '認証に使用できるアイテムは、Avatioに登録できるアイテムのみです。非公開アイテムや、非対応プラットフォームのアイテムは使用できません。また、現在GitHubはショップ認証に対応していません。',
            generatingCode: 'コードを生成中...',
            verify: 'ショップを認証',
            newShop: '新しくショップを認証',
            unverify: 'ショップの認証を解除',
            unverifyConfirm: '本当にショップの認証を解除しますか？',
            verified: 'ショップが認証されました',
            unverified: 'ショップの認証を解除しました',
            deleteCodeNote: '認証が完了した後、追記したコードは削除してください',
            notVerifiable: 'このURLは認証可能なアイテムではありません',
            noVerifiedShops: '認証済みのショップはありません',
        },
        account: {
            title: 'アカウント',
            logoutOthers: 'このブラウザ以外からログアウト',
            logoutOthersDesc:
                '現在使用しているブラウザ以外のすべてのデバイスからログアウトします。',
            logoutOthersButton: 'すべてのデバイスからログアウト',
            logoutAll: 'すべてのアカウントからログアウト',
            logoutAllDesc: '同時にログインしているすべてのアカウントからログアウトします。',
            logoutAllButton: 'すべてログアウト',
        },
        dangerZone: {
            title: 'DANGER ZONE',
            deleteAccount: 'アカウント削除',
            deleteAccountDesc:
                'アカウントおよびアカウントに紐づくデータをすべて削除します。削除したアカウントは復元できません。',
        },
    },

    welcome: {
        title: 'ようこそ！',
        description: 'ユーザーIDを設定して、始めましょう。',
        changeUsername: 'ユーザーIDを変更',
    },

    index: {
        hero: {
            title: 'お気に入りの<wbr>改変を<wbr>記録して<wbr>共有しよう',
            description:
                'あのアイテムって<wbr />どれだっけ？ <wbr />記録しておけば、<wbr />もう忘れません。',
            getStarted: 'はじめる',
        },
        tabs: {
            latest: '最新',
            me: '自分の投稿',
            bookmarks: 'ブックマーク',
        },
        seo: {
            title: 'Avatio',
            description: 'あなたのアバター改変を共有しよう',
        },
    },

    search: {
        title: 'セットアップ検索',
        placeholder: 'セットアップを検索...',
        keyword: '検索キーワード',
        description: '条件を指定してセットアップを検索できます。',
        notFound: 'セットアップが見つかりませんでした',
        options: {
            title: '詳細オプション',
            selectItem: 'アイテムを選択',
            addItem: 'アイテムを追加',
            tagPlaceholder: 'タグを入力',
            itemSection: 'アイテム',
            tagSection: 'タグ',
            removeItem: '{name} を削除',
        },
        popularAvatars: '人気のアバター',
        popularAvatarsTitle: '人気のアバターから検索',
        listEmpty: 'セットアップが見つかりませんでした',
    },

    commandPalette: {
        itemSearch: {
            placeholder: 'アイテムを検索 / URLを入力',
            addFromUrl: 'URLから追加',
            invalidUrl: '無効なURL',
            invalidUrlDescription: '正しいアイテムのURLを入力してください。',
            fetchError: 'アイテムの取得に失敗しました',
            fetchErrorDescription: 'アイテムが存在しないか、非公開になっている可能性があります。',
        },
        tagSearch: {
            placeholder: 'タグを検索 / 入力',
            existingTags: '既存タグ',
            addNew: '新しく追加',
        },
        userSearch: {
            placeholder: 'ユーザーを検索 / IDを入力',
            users: 'ユーザー',
            addFromId: 'IDから追加',
            userNotFound: 'ユーザーが見つかりません',
            userNotFoundDescription: '入力したIDのユーザーが存在しないか、アクセスできません。',
        },
    },

    setup: {
        compose: {
            title: 'セットアップを投稿',
            editTitle: 'セットアップを編集',
            seoDescription: '新しいセットアップを投稿します。',
            seoEditDescription: 'セットアップの編集を行います。',
            nameLabel: 'タイトル',
            namePlaceholder: 'セットアップ名',
            descriptionLabel: '説明',
            descriptionPlaceholder: '説明',
            draftButton: '下書き',
            publishButton: '公開',
            updateButton: '更新',
            newSetupConfirm: '新しいセットアップを作成しますか？',
            newSetupCreate: '新規作成',
            confirmLeave: '入力された内容が破棄されます。よろしいですか？',
            draftStatus: {
                restoring: '復元中...',
                restored: '復元しました',
                unsaved: '未保存の変更',
                saving: '保存中...',
                saved: '保存しました',
                error: '保存に失敗',
            },
            draftAlert: {
                errorNotSaved: 'エラーにより下書きが保存されていません！',
                currentlySaved: '現在の状態は下書きに保存されています',
            },
            items: {
                title: 'アイテム',
                add: 'アイテムを追加',
                remove: 'アイテムを削除',
                changeCategory: 'アイテムのカテゴリーを変更',
                incompatible: 'ベースアバターに非対応',
                shapekeys: 'シェイプキー',
                shapekeysCount: '{count} 個のシェイプキー',
                shapekeyPlaceholder: 'シェイプキー名称',
                notePlaceholder: 'ノートの追加',
                empty: 'アイテムが登録されていません',
                noShapekeys: 'シェイプキーがありません',
            },
            images: {
                title: '画像',
                add: '画像を追加',
                dropAdd: 'ドロップして追加',
                uploading: '画像をアップロード中...',
            },
            tags: {
                title: 'タグ',
                add: 'タグを追加',
            },
            coauthors: {
                title: '共同作者',
                placeholder: '共同作者を追加',
                note: 'ノート',
            },
            drafts: {
                title: '下書き',
                empty: '下書きがありません',
                loading: '取得中...',
                back: '戻る',
                delete: '下書きを削除',
                deleteConfirm: '本当にこの下書きを削除しますか？',
                limitReached: '保存できる下書きの上限に達しています',
                limitReachedDescription:
                    '新しい下書きを保存するには、既存の下書きを削除してください',
            },
            newSetup: '新しいセットアップを作成',
            newSetupModal: {
                title: '新規作成',
            },
            draftsDescription: `最大で${MAX_SETUP_DRAFTS}件まで保存できます`,
        },
        viewer: {
            show: 'セットアップを表示',
            hide: 'セットアップを非表示',
            hiddenNotice: 'このセットアップは現在非表示です',
            deleted: '削除されたか、非公開になっている可能性があります。',
            bookmark: 'ブックマーク',
            unbookmark: 'ブックマークから削除',
            report: 'このセットアップを報告',
            searchByItem: 'アイテムからセットアップを検索',
            reportItem: 'アイテムを報告',
            showNsfw: 'NSFW コンテンツを表示',
            reason: '理由',
            reasonUnknown: '不明',
            objectToHiding: '異議申し立て',
            objectToHidingSubject: 'セットアップ非表示に対する異議申し立て',
            imageAlt: 'の画像',
            failedItemsCount: '個のアイテムが取得できませんでした',
            unavailableForAvatar: 'アバター非対応',
            shapekeys: 'シェイプキー',
            valueCopied: '{name} の値をコピーしました',
            updatedAt: 'に更新',
            editedAt: 'に編集',
            coauthors: '共同作者',
            editing: '編集中',
            untitled: '無題',
        },
    },

    changelogs: {
        title: '変更履歴',
        description: 'Avatioの変更履歴を確認できます。',
    },

    footer: {
        social: {
            x: 'X',
            github: 'GitHub',
        },
        links: {
            changelogs: '変更履歴',
            faq: 'FAQ',
            feedback: 'フィードバック',
            feedbackDescription: 'ご意見をお聞かせください。フィードバックは匿名で送信されます。',
        },
        legal: {
            terms: '利用規約',
            privacy: 'プライバシー',
        },
    },

    modal: {
        login: {
            title: 'ログイン',
            continueWith: '{provider} で続行',
            agreement: 'ログインすることで以下に同意したことになります:',
            footer: {
                terms: '利用規約',
                privacy: 'プライバシーポリシー',
            },
        },
        feedback: {
            title: 'フィードバック',
            comment: 'コメント',
            placeholder: 'コメントを入力',
            submitted: 'フィードバックを送信しました',
        },
        publishComplete: {
            title: 'セットアップを公開しました！',
            continuePosting: '続けて投稿',
            viewSetup: '投稿したセットアップを見る',
        },
        deleteSetup: {
            title: 'セットアップを削除',
            confirm: '本当にこのセットアップを削除しますか？',
            description: '削除したセットアップは復元できません。',
        },
        deleteAccount: {
            title: 'アカウント削除',
            confirm: '本当にアカウントを削除しますか？',
            description: '削除したアカウントは復元できません。',
        },
        report: {
            setup: {
                title: 'セットアップを報告',
                reason: '報告の理由',
                comment: '報告の詳細や背景情報',
                commentPlaceholder: 'その他の理由を入力',
                submitted: 'セットアップを報告しました',
                reasons: {
                    spam: {
                        label: 'スパム、個人情報、不適切な内容',
                        description:
                            '荒らし目的で類似の投稿を複数回行っている、投稿内容に自身および他者の個人情報を含んでいる、その他不適切な内容を含んでいる。',
                    },
                    hate: {
                        label: '差別、暴力、誹謗中傷',
                        description:
                            '人種、性別、宗教、性的指向、障害、疾病、年齢、その他の属性に基づく差別的な表現、暴力的な表現などが含まれている。',
                    },
                    infringe: {
                        label: '他者への権利侵害',
                        description:
                            '自身および第三者の著作権、商標権、肖像権、またはその他の権利侵害が予想される。',
                    },
                    badImage: {
                        label: '過激な画像',
                        description:
                            '過度な露出、暴力表現などを含む画像を添付している\nNSFWタグが付いている投稿であっても、過激な画像を添付することは禁止されています。',
                    },
                    other: {
                        label: 'その他',
                        description: 'その他の理由で報告',
                    },
                },
            },
            user: {
                title: 'ユーザーを報告',
                reason: '報告の理由',
                comment: '報告の詳細や背景情報',
                commentPlaceholder: 'その他の理由を入力',
                submitted: 'ユーザーを報告しました',
                reasons: {
                    spam: {
                        label: 'スパム',
                        description: 'スパムの投稿を含む。',
                    },
                    hate: {
                        label: '悪意のあるユーザー',
                        description: 'ヘイト、差別、脅迫など悪意のある内容を投稿している。',
                    },
                    infringe: {
                        label: '権利侵害',
                        description: '他者の権利を侵している、または権利侵害を助長している。',
                    },
                    badImage: {
                        label: '不適切な画像',
                        description: '不適切なアイコンなどを含む。',
                    },
                    other: {
                        label: 'その他',
                        description: 'その他の理由で報告',
                    },
                },
            },
            item: {
                title: 'アイテムを報告',
                reason: '報告の理由',
                comment: '報告の詳細や背景情報',
                commentPlaceholder: 'その他の理由を入力',
                submitted: 'アイテムを報告しました',
                reasons: {
                    nameError: {
                        label: 'アイテム名称の誤り',
                        description:
                            'アイテムの名称が誤っている、ニュアンスが異なっている、または不適切である。',
                    },
                    irrelevant: {
                        label: '無関係なアイテム',
                        description: 'アイテムが VR アバターに関連していない。',
                    },
                    other: {
                        label: 'その他',
                        description: 'その他の理由で報告',
                    },
                },
            },
        },
        markdownSupported: 'Markdownをサポートしています',
    },

    notifications: {
        title: '通知',
        read: '既読の通知',
        empty: '通知がありません',
        markAsRead: '既読にする',
        markAsUnread: '未読にする',
    },

    errors: {
        generic: 'エラーが発生しました',
        notFound: 'ページが見つかりません',
        backToHome: 'ホームに戻る',
        invalidId: 'IDが無効です',
        setupNotFound: 'セットアップが見つかりません',
        userDataFetchFailed: 'ユーザーデータの取得に失敗しました',
        unauthorized: '権限がありません',
        adminRequired: 'Adminアカウントでログインしてください。',
        reportBug: '不具合を報告',
    },

    user: {
        editProfile: 'プロフィールを編集',
        reportUser: 'ユーザーを報告',
        bio: 'bio',
        shops: 'ショップ',
        setups: 'セットアップ',
    },

    nsfw: {
        label: 'NSFW',
    },

    badges: {
        developer: 'デベロッパー',
        contributor: 'コントリビューター',
        translator: '翻訳者',
        alphaTester: 'アルファテスター',
        shopOwner: 'ショップオーナー',
        patrol: 'パトロール',
        ideaMan: 'アイデアマン',
    },

    input: {
        username: {
            label: 'ユーザーID',
            placeholder: 'ユーザーIDを入力',
            checking: '確認中...',
            available: '使用可能',
            unavailable: 'このユーザーIDはすでに使用されています。',
            error: 'ユーザーIDの確認中にエラーが発生しました。',
        },
    },

    banner: {
        ownerWarning:
            'あなたがアバター・アイテムの制作者であり、Avatioに掲載されることを拒否したい場合は、お手数ですがこちらよりご連絡をお願いします。',
        ownerWarningSubject: 'Avatioへの掲載拒否',
    },

    loginPage: {
        continueWith: '{provider} でログイン',
    },

    admin: {
        label: 'admin',
        users: {
            profile: 'プロフィール',
            role: 'ロール',
            roleUser: 'ユーザー',
            roleAdmin: '管理者',
            ban: 'BAN',
            unban: 'BAN解除',
            updated: 'に更新',
        },
        feedbacks: {
            empty: 'フィードバックはありません。',
            open: 'オープン',
            close: 'クローズ',
        },
        auditLogs: {
            userBan: 'ユーザーをBAN',
            userUnban: 'ユーザーのBAN解除',
            userDelete: 'ユーザーを削除',
            userRoleChange: 'ユーザーロールの変更',
            userShopVerify: 'ユーザーのショップを承認',
            userShopUnverify: 'ユーザーのショップを非承認',
            userBadgeGrant: 'ユーザーにバッジを付与',
            userBadgeRevoke: 'ユーザーのバッジを剥奪',
            setupHide: 'セットアップを非表示',
            setupUnhide: 'セットアップを表示',
            setupDelete: 'セットアップを削除',
            reportResolve: '報告を解決',
            feedbackClose: 'フィードバックをクローズ',
            cleanup: 'クリーンアップ',
        },
        changelogsCompose: {
            duplicateAuthor: '著者を重複して追加することはできません',
        },
        reports: {
            user: {
                reasons: {
                    spam: 'スパム',
                    malicious: '悪意のあるユーザー',
                    infringement: '権利侵害',
                    inappropriate: '不適切な画像',
                    other: 'その他',
                },
            },
            setup: {
                reasons: {
                    spam: 'スパム、個人情報、不適切な内容',
                    hate: '差別、暴力、誹謗中傷',
                    infringement: '他者への権利侵害',
                    extreme: '過激な画像',
                    other: 'その他',
                },
            },
            item: {
                reasons: {
                    wrongName: 'アイテム名称の誤り',
                    unrelated: '無関係なアイテム',
                    other: 'その他',
                },
            },
        },
        modal: {
            banUser: {
                title: 'ユーザーをBAN',
                reason: '理由',
                reasonPlaceholder: '理由を入力してください',
                duration: 'BAN期間 (秒)',
                durationPlaceholder: '0 で無期限',
                button: 'BAN',
            },
            changeItemNiceName: {
                title: 'アイテム名称を変更',
                newName: '新しい名称',
                button: '変更',
            },
            flags: {
                title: 'Flags',
                maintenanceMode: 'メンテナンスモード',
                forceUpdateItem: 'アイテム情報の強制更新',
            },
            hideSetup: {
                title: 'セットアップを非表示',
                reason: '理由',
                button: '非表示にする',
                adminNote: 'これはAdminアクションです',
                description:
                    'セットアップは非表示になり、再度表示するまでユーザーには見えなくなります。',
            },
            unhideSetup: {
                title: 'セットアップを再表示',
                confirm: '本当にこのセットアップを再表示しますか？',
                button: '再表示する',
                adminNote: 'これはAdminアクションです',
                description: 'セットアップは再表示され、ユーザーに見えるようになります。',
            },
        },
    },
}))
