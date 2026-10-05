[![Avatio][banner]][avatio]

<div align="center">

# Avatio

VRSNSユーザー向けのアバターセットアップ共有サービス。<br>
「セットアップ」を作成し、ユーザーが使用しているアバター・衣装・装飾品・ツールなどをリストできます。

![Last commit](https://www.shieldcn.dev/github/last-commit/liria24/avatio.svg?variant=secondary&size=xs)
![Commits](https://www.shieldcn.dev/github/commits/liria24/avatio.svg?variant=secondary&size=xs)
![Release](https://www.shieldcn.dev/github/release/liria24/avatio.svg?size=xs)
![CI](https://www.shieldcn.dev/github/ci/liria24/avatio.svg?variant=secondary&size=xs)

</div>

## ✨ Features

- 🚀 セットアップを投稿
- 🐫 BOOTH商品ページへジャンプ
- 🔖 ブックマーク
- 🎉 **完全無料！**

アイテムの登録は URL を指定するだけでOK !

### 対応プラットフォーム

- 🐫 [BOOTH](https://booth.pm)
- 🐙 [GitHub](https://github.com)

## 🛠 Tech Stack

[![Cloudflare badge][badge-cloudflare]][cloudflare]
[![Nuxt badge][badge-nuxt]][nuxt]
[![Tailwind badge][badge-tailwind]][tailwind]
[![Better Auth badge][badge-better-auth]][better-auth]
[![Drizzle ORM badge][badge-drizzle]][drizzle]
[![Oxc badge][badge-oxc]][oxc]

## Cloudflare Preview の準備状況（#354）

現在の実行環境は Nuxt 4.5.2、デプロイは引き続き Alchemy です。公開ビルド設定とサーバーの binding 型を Alchemy から分離し、`cf@1.0.0-beta.11` 用の `cloudflare.config.ts`、PR のメール・パスワード認証、lease で保護された inline Catalog 同期を用意しています。`vp run test:cloudflare` は、秘密情報や Cloudflare への書き込みなしで設定・対象判定・認証を検証します。同じテストは通常の quality workflow の全テスト検査にも含まれます。

将来の `cf` 設定は Worker 名を `avatio` に固定し、`production`、永続 Preview の `development`、PR Preview の `pr-<番号>` を区別します。`AVATIO_CF_RESOURCES_FILE` には確認済みの実資源 ID を含む JSON を明示し、PR ごとに D1・KV・R2 を分離します。資源の自動作成やテスト用 ID へのフォールバックはありません。入力項目とビルド環境は [AGENTS.md](./AGENTS.md#native-cloudflare-preview-preparation-354) を参照してください。

実デプロイと資源の作成・削除は未接続です。有効化には Nuxt/Nitro の Build Output と既存 tasks・plugins・cache の互換性、Preview secrets と close/reopen のライフサイクル、実資源 ID、既存データ入り D1 の migration 履歴移行の検証が必要です。Nuxt 4.6 のリリースだけでは切り替えません。Workers Builds、Alchemy、`avatio-development`、ローカル SQLite と seed 経路は現行運用を継続します。

Setup画像の`stableId`は必須・一意です。追加migrationは既存IDを維持し、未設定の画像だけ数値主キーの文字列で補完します。衝突時はIDを振り直さず失敗するため、デプロイ前に対象DBのバックアップでmigrationを検証してください。

ブックマーク一覧APIは`GET /api/setups?bookmarked=true`を使用します。旧`GET /api/setups/bookmarks`一覧は廃止し、個別ブックマークの取得・追加・削除は維持しています。

## Testing

`vp run test` and `vp run test:watch` run the fast local unit project. SQLite integration, Nuxt DOM, real HTTP contracts, Miniflare bindings, browser smoke, and the Cloudflare build run in CI. `vp run test:ci` selects the full Vitest suite; browser commands are separate.

Every PR runs all existing regression coverage and Chromium smoke. Development/main pushes, daily runs, and manual runs also exercise extended Chromium, Firefox, WebKit, and mobile flows. The required `test` check succeeds only when all suites required for that event succeed. Browser tests use isolated temporary data and synthetic accounts, block external traffic, and preserve failure traces briefly. See [AGENTS.md](./AGENTS.md#testing) for commands and fixture boundaries.

## 🤝 Contributions

Avatioはオープンソースプロジェクトです。

バグの報告、新機能の提案、コードの改善など、あらゆる規模・スキルレベルのコントリビュートを歓迎します。

### Contributors

[![Contributors][contributors-image]][contributors]

## ⚖ Legal information

<div align="center">

[利用規約][avatio-terms]
・
[プライバシーポリシー][avatio-privacy]

Copyright © 2025 **[Liria][liria]**

</div>

BOOTH は ピクシブ株式会社の登録商標です。<br>
Avatio は、ピクシブ株式会社 および BOOTH とは関係ありません。

<!-- links -->

[banner]: /public/readme_hero.png
[avatio]: https://avatio.me
[avatio-terms]: https://avatio.me/terms
[avatio-privacy]: https://avatio.me/privacy-policy
[liria]: https://liria.me
[cloudflare]: https://cloudflare.com/developer-platform/products/workers
[nuxt]: https://nuxt.com
[tailwind]: https://tailwindcss.com
[badge-cloudflare]: https://svgl-badge.vercel.app/api/Software/Cloudflare?theme=dark
[badge-nuxt]: https://svgl-badge.vercel.app/api/Framework/Nuxt?theme=dark
[badge-tailwind]: https://svgl-badge.vercel.app/api/Framework/Tailwind%20CSS?theme=dark
[contributors]: https://github.com/liria24/avatio/graphs/contributors
[contributors-image]: https://contrib.rocks/image?repo=liria24/avatio&anon=1
[better-auth]: https://better-auth.com
[drizzle]: https://orm.drizzle.team
[badge-better-auth]: https://svgl-badge.vercel.app/api/Authentication/Better%20Auth?theme=dark
[badge-drizzle]: https://svgl-badge.vercel.app/api/Database/Drizzle%20ORM?theme=dark
[oxc]: https://oxc.rs
[badge-oxc]: https://svgl-badge.vercel.app/api/Devtool/Oxc?theme=dark
