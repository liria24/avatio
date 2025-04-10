<script lang="ts" setup>
import { z } from 'zod';
const client = useSupabaseClient();
const user = useSupabaseUser();
if (!user.value) showError('ログインしてください');

const userSettingsSchema = z.object({
    name: z
        .string()
        .min(1, 'ユーザー名を入力してください')
        .max(124, 'ユーザー名は124文字以内で入力してください')
        .refine(
            (name) => !/^\s+$/.test(name),
            '空白のみのユーザー名は使用できません'
        ),
    bio: z.string().max(140, 'bioは140文字以内で入力してください'),
    links: z
        .array(z.string().url('有効なURLを入力してください'))
        .max(8, 'リンクは8個以内に制限してください'),
});

const { data } = await client
    .from('users')
    .select('name, avatar, bio, links')
    .eq('id', user.value!.id)
    .maybeSingle<{
        name: string;
        avatar: string;
        bio: string;
        links: string[];
    }>();

const name = ref<string>(data?.name ?? '');
const avatar = ref<File | null>(null);
const currentAvatar = ref<string | null>(data?.avatar ?? null);
const bio = ref<string>(data?.bio ?? '');
const links = ref<string[]>(data?.links ?? []);

const saving = ref(false);

const save = async () => {
    const validationResult = userSettingsSchema.safeParse({
        name: name.value,
        bio: bio.value,
        links: links.value,
    });

    if (!validationResult.success) {
        // バリデーションエラーがある場合、最初のエラーメッセージを表示
        const formattedErrors = validationResult.error.format();
        const firstError =
            formattedErrors.name?._errors[0] ||
            formattedErrors.bio?._errors[0] ||
            formattedErrors.links?._errors[0];

        if (firstError) return useToast().add(firstError);
    }

    saving.value = true;

    let avatarName = currentAvatar.value;
    if (avatar.value) {
        const uploaded = await usePutImage(avatar.value, {
            target: 'avatar',
            resolution: 512,
            size: 300,
        });

        if (!uploaded) {
            useToast().add(
                'ユーザー情報の保存に失敗しました',
                'アバターのアップロードでエラーが発生しました'
            );
            saving.value = false;
            return;
        }

        if (currentAvatar.value)
            await useDeleteImage(currentAvatar.value, { target: 'avatar' });

        avatarName = uploaded.name;
    }

    const { error } = await client
        .from('users')
        .update({
            name: name.value,
            bio: bio.value,
            avatar: avatarName,
            links: links.value,
        })
        .eq('id', user.value!.id);

    if (error) {
        saving.value = false;
        return useToast().add('ユーザー情報の保存に失敗しました');
    }

    currentAvatar.value = avatarName;
    userProfile.value.name = name.value;
    userProfile.value.avatar = avatarName || null;
    useToast().add('ユーザー情報を保存しました');
    saving.value = false;
};

const deleteAvatar = async () => {
    if (!currentAvatar.value) return;

    saving.value = true;

    const { error } = await client
        .from('users')
        .update({ avatar: null })
        .eq('id', user.value!.id);

    if (error) {
        saving.value = false;
        return useToast().add('アバターの削除に失敗しました');
    }

    await useDeleteImage(currentAvatar.value, { target: 'avatar' });
    userProfile.value.avatar = null;
    currentAvatar.value = null;
    useToast().add('アバターを削除しました');
    saving.value = false;
};

useOGP({ title: 'ユーザー設定' });
</script>

<template>
    <div v-if="!data" class="w-full flex flex-col items-center">
        <p class="text-zinc-400 mt-5">ユーザーデータの取得に失敗しました</p>
    </div>

    <div v-else class="w-full px-2 flex flex-col gap-4">
        <div class="flex items-center justify-between">
            <UiTitle
                label="プロフィール"
                icon="lucide:user-round"
                size="lg"
                is="h1"
            />
        </div>

        <div
            class="w-full p-5 rounded-xl flex flex-col gap-6 ring-1 ring-zinc-300 dark:ring-zinc-600"
        >
            <div class="grow flex items-center gap-8">
                <UserSettingAvatar
                    v-model:avatar="avatar"
                    v-model:current-avatar="currentAvatar"
                    @delete-avatar="deleteAvatar"
                />

                <div class="grow flex flex-col gap-2">
                    <div class="grow flex items-center justify-between">
                        <UiTitle
                            label="ユーザー名"
                            icon="lucide:pencil"
                            is="h2"
                        />
                        <p
                            v-if="name?.length > 124"
                            class="text-sm font-medium whitespace-nowrap text-red-400 dark:text-red-400"
                        >
                            {{ name?.length || 0 }} / 124
                        </p>
                    </div>

                    <UserSettingName v-model="name" class="w-full" />
                </div>
            </div>

            <div class="grow flex flex-col gap-2">
                <div class="grow flex items-center justify-between">
                    <UiTitle label="bio" icon="lucide:text" is="h2" />
                    <p
                        :data-exceeded="bio?.length > 141"
                        class="text-sm font-medium whitespace-nowrap text-zinc-700 dark:text-zinc-400 data-[exceeded=true]:text-red-400 dark:data-[exceeded=true]:text-red-400"
                    >
                        {{ bio?.length || 0 }} / 140
                    </p>
                </div>

                <UserSettingBio v-model="bio" />
            </div>

            <div class="grow flex flex-col gap-2">
                <div class="grow flex items-center justify-between">
                    <UiTitle label="リンク" icon="lucide:link" is="h2" />
                    <p
                        :data-exceeded="links?.length > 8"
                        class="text-sm font-medium whitespace-nowrap text-zinc-700 dark:text-zinc-400 data-[exceeded=true]:text-red-400 dark:data-[exceeded=true]:text-red-400"
                    >
                        {{ links?.length || 0 }} / 8
                    </p>
                </div>

                <UserSettingLinks v-model="links" />
            </div>

            <UiDivider />

            <Button :disabled="saving" @click="save">
                <Icon
                    :name="saving ? 'svg-spinners:ring-resize' : 'lucide:save'"
                    size="18"
                    class="text-zinc-600 dark:text-zinc-300"
                />
                <span class="hidden md:inline">
                    {{ saving ? '保存中' : '保存' }}
                </span>
            </Button>
        </div>

        <UiTitle
            label="ショップ"
            icon="lucide:store"
            size="lg"
            is="h1"
            class="mt-5"
        />
        <UserSettingShopVerify />

        <UiTitle
            label="アカウント"
            icon="lucide:bolt"
            size="lg"
            is="h1"
            class="mt-5"
        />
        <UserSettingAccount />
    </div>
</template>
