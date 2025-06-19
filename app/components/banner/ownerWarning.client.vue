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
        <p class="text-toned text-xs break-keep">
            {{
                useLineBreak(
                    'あなたがアバター・アイテムの制作者であり、Avatioに掲載されることを拒否したい場合は、お手数ですが'
                )
            }}
            <NuxtLink
                to="https://github.com/liria24/avatio/issues/new/choose"
                target="_blank"
                class="font-medium hover:underline"
            >
                こちら
            </NuxtLink>
            {{ useLineBreak('よりご連絡をお願いします。') }}
        </p>

        <UButton
            icon="lucide:x"
            variant="ghost"
            size="sm"
            class="place-self-end"
            @click="onClick"
        />
    </div>
</template>
