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

Avatio is a Bun workspace modular monolith. Pure domains live in `@avatio/core`, Nuxt integration in `@avatio/nuxt`, and current infrastructure adapters in `@avatio/cloudflare`. Items and publishers use Avatio-owned identities across providers. Setup entries preserve category overrides, notes, and shapekeys; provider availability and refresh errors remain separate. Configuration, secret operations, and deployment guidance are maintained in [AGENTS.md](AGENTS.md).

## ローカル開発

Node.js 26、Bun 1.4.2、Vite+ 0.3.1を用意し、次の2コマンドを実行します。

```sh
vp install
vp run dev
```

`http://localhost:3000`で通常のNuxt dev serverが起動します。Cloudflare、Alchemy、Wranglerへのログインや`.env.keys`は不要です。初回起動時に既存のDrizzle migrationを適用した`.data/avatio.sqlite`と、再起動後も維持されるローカル認証secretを自動生成します。ログイン画面のローカル専用フォームから、規約とプライバシーポリシーへの同意を伴うemail/passwordアカウントを作成でき、空のDBで最初に作成されたユーザーだけがadminになります。

ローカルでは、authored contentは`content/`、uploadは`.data/uploads`、送信メールは`.data/mail`を使用します。画像の表示とupload解析にはIPXを使用し、Catalog Queueは同じ同期処理をinline実行します。CloudflareのD1/R2/Images/Queue/Flagship/Email、外部analytics、Discord通知は使用しません。BOOTH proxy、Twitter OAuth、Workers AIは任意で、未設定でも基本操作とGitHub Catalogを利用できます。ローカルQueueはCloudflare Queueのretry／配信保証を再現しません。

任意のローカル設定にはNuxt標準の`.env`を使用できます。Bun自身の自動dotenv読込は無効で、暗号化された`.env.development`と`.env.production`はplan/deploy用のNodeスクリプトがdotenvx `--strict`でのみ読み込みます。deployed developmentは引き続きCloudflare上の`development` stageであり、local stageではありません。

既存のremote D1を明示的に取り込む場合だけ、`vp run db:seed:local -- --yes`を使用します。これはremote D1を読み取りますが、remoteへ書き込みません。productionからの取込には`--source production --allow-production`が必要です。

Deployed Workers read authored content from GitHub through the existing KV cache and store uploads in R2. Terms and Privacy keep independent versions and append-only acceptance history. PR quality checks run format, lint, Knip, typecheck, tests, and build without production secrets.

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
