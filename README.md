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

Avatio is a Bun workspace modular monolith. Pure domains live in `@avatio/core`, Nuxt integration in `@avatio/nuxt`, and current infrastructure adapters in `@avatio/cloudflare`. Items and publishers use Avatio-owned identities across providers. Setup entries preserve category overrides, notes, and shapekeys; provider availability and refresh errors remain separate. Configuration, secret operations, and the remaining database contract procedure are maintained in [AGENTS.md](AGENTS.md).

`bun run dev` serves `http://localhost:3000`, reads authored Markdown from `content/`, and saves uploads to gitignored `.data/uploads`. Its Alchemy state stays in `.alchemy/state`, separate from deployed resources in the Cloudflare state store. Deployed Workers read authored content from GitHub through the existing KV cache and store uploads in R2. Terms and Privacy keep independent versions and append-only acceptance history. PR quality checks run lint, typecheck, tests, and build without production secrets.

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
