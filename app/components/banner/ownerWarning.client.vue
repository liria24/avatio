<script lang="ts" setup>
import { createStorage } from 'unstorage';
import localStorageDriver from 'unstorage/drivers/localstorage';

const storage = createStorage({
    driver: localStorageDriver({}),
});

const visible = ref(false);

if (!(await storage.has('ownerWarningBanner'))) visible.value = true;

const save = async () => await storage.set('ownerWarningBanner', true);
</script>

<template>
    <div v-if="visible" class="px-2 gap-2 flex items-center justify-between">
        <p class="text-xs break-keep text-zinc-700 dark:text-zinc-300">
            {{
                useSentence(
                    'あなたがアバター・アイテムの制作者であり、Avatioに掲載されることを拒否したい場合は、お手数ですが'
                )
            }}
            <NuxtLink
                to="https://github.com/liria24/avatio/issues/new/choose"
                target="_blank"
                class="font-medium text-zinc-500 dark:text-zinc-400 hover:underline"
            >
                こちら
            </NuxtLink>
            {{ useSentence('よりご連絡をお願いします。') }}
        </p>

        <Button
            icon="lucide:x"
            variant="flat"
            class="place-self-end rounded-full p-2"
            @click="
                visible = false;
                save();
            "
        />
    </div>
</template>
