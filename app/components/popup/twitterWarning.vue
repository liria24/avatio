<script setup lang="ts"></script>

<template>
    <Popup>
        <template #trigger>
            <div class="flex cursor-pointer items-center gap-1.5">
                <Icon
                    name="lucide:info"
                    class="text-red-400 dark:text-red-300"
                />
                <span
                    class="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                >
                    X アカウントでログインできない場合
                </span>
            </div>
        </template>

        <template #content>
            <div class="flex flex-col gap-1.5 text-zinc-700 dark:text-zinc-300">
                <h3 class="font-bold">X アカウントでログインできない場合</h3>

                <p class="text-sm/relaxed">
                    現在、X
                    アカウントにメールアドレスが登録されていない場合、ログインができません。<br />
                    お手数をおかけしますが、X
                    アカウントにメールアドレスを設定してからログインをお試しください。
                </p>

                <p class="text-sm/relaxed font-bold">エラー例 :</p>
                <NuxtImg
                    :src="
                        getImage('twitter-login-error.png', {
                            prefix: 'static',
                        })
                    "
                    alt="エラーが発生しました。このページに対するリクエストトークンがありません。アプリケーションがXアカウントを使用するかどうかを確認するために必要な特殊キーです。送信したサイトまたはアプリケーションに戻って再度お試しください。何らかの手違いがあったかもしれません。"
                    class="max-w-[480px] rounded-lg"
                />
            </div>
        </template>
    </Popup>
</template>
