<script lang="ts" setup>
import { createStorage } from 'unstorage'
import localStorageDriver from 'unstorage/drivers/localstorage'

const { app } = useAppConfig()

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
    <div
        v-if="visible"
        class="ring-muted flex items-center justify-between gap-3 rounded-lg px-3 py-2 ring-1"
    >
        <ULink :to="`mailto:${app.mailaddress}?subject=Avatioへの掲載拒否`">
            <p class="text-toned w-fit text-xs wrap-anywhere break-keep">
                あなたがアバター・アイテムの制作者であり、Avatioに掲載されることを拒否したい場合は、お手数ですがこちらよりご連絡をお願いします。
            </p>
        </ULink>

        <UButton
            aria-label="閉じる"
            icon="lucide:x"
            variant="ghost"
            size="sm"
            class="place-self-end"
            @click="onClick"
        />
    </div>
</template>
