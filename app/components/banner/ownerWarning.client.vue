<script lang="ts" setup>
import { createStorage } from 'unstorage'
import localStorageDriver from 'unstorage/drivers/localstorage'

const storage = createStorage({
    driver: localStorageDriver({}),
})

const visible = ref(false)

if (!(await storage.has('ownerWarningBanner'))) visible.value = true

const save = async () => await storage.set('ownerWarningBanner', true)

const onClick = () => {
    visible.value = false
    save()
}
</script>

<template>
    <div v-if="visible" class="flex items-center justify-between gap-2 px-2">
        <p class="text-xs break-keep text-zinc-700 dark:text-zinc-300">
            {{
                lineBreak(
                    'あなたがアバター・アイテムの制作者であり、Avatioに掲載されることを拒否したい場合は、お手数ですが'
                )
            }}
            <NuxtLink
                to="https://github.com/liria24/avatio/issues/new/choose"
                target="_blank"
                class="font-medium text-zinc-500 hover:underline dark:text-zinc-400"
            >
                こちら
            </NuxtLink>
            {{ lineBreak('よりご連絡をお願いします。') }}
        </p>

        <Button
            icon="lucide:x"
            variant="flat"
            class="place-self-end rounded-full p-2"
            @click="onClick"
        />
    </div>
</template>
