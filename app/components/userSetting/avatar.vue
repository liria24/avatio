<script lang="ts" setup>
const avatar = defineModel<Blob | null>('avatar', {
    required: true,
    default: null,
})
const currentAvatar = defineModel<string | null>('currentAvatar', {
    required: true,
    default: null,
})

const emit = defineEmits(['deleteAvatar'])

const croppingImage = ref<File | null>(null)
const imageCroppedPreview = ref<string | null>(null)
const modalCropAvatar = ref(false)
const loading = ref(false)

const { open, onChange, reset } = useFileDialog({
    accept: 'image/png, image/jpeg, image/webp, image/tiff',
    multiple: false,
})

onChange((files) => {
    if (files?.length && files[0]) {
        const file = files[0]
        croppingImage.value = file
        modalCropAvatar.value = true
    } else {
        croppingImage.value = null
    }
})

const fileSelect = () => {
    reset()
    open()
}

const removeAvatar = () => {
    croppingImage.value = null
    emit('deleteAvatar')
}

watchEffect(() => {
    if (avatar.value) {
        const reader = new FileReader()
        reader.onload = (e) => {
            if (!e.target) return
            imageCroppedPreview.value = e.target.result as string
        }
        reader.readAsDataURL(avatar.value)
    } else {
        imageCroppedPreview.value = null
    }
})
</script>

<template>
    <div
        class="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700"
    >
        <Icon
            v-if="loading"
            name="svg-spinners:ring-resize"
            size="36"
            class="text-zinc-600 dark:text-zinc-300"
        />
        <NuxtImg
            v-else-if="imageCroppedPreview"
            :src="imageCroppedPreview.toString()"
            alt="アバター"
            width="80"
            height="80"
            format="webp"
            fit="cover"
            loading="lazy"
            class="shrink-0"
        />
        <NuxtImg
            v-else-if="currentAvatar?.length"
            :src="getImage(currentAvatar, { prefix: 'avatar' })"
            alt="アバター"
            width="80"
            height="80"
            format="webp"
            fit="cover"
            loading="lazy"
            class="shrink-0"
        />
        <Icon
            v-else
            name="lucide:user-round"
            size="36"
            class="text-zinc-600 dark:text-zinc-300"
        />

        <Popup>
            <template #trigger>
                <button
                    v-if="!loading"
                    type="button"
                    class="absolute inset-0 cursor-pointer rounded-full hover:bg-black/20"
                />
            </template>

            <template #content>
                <div
                    class="flex min-w-48 flex-col items-stretch gap-0.5 text-sm"
                >
                    <PopoverClose class="w-full">
                        <Button
                            variant="flat"
                            class="w-full"
                            @click="fileSelect"
                        >
                            <Icon
                                name="lucide:camera"
                                size="18"
                                class="text-zinc-600 dark:text-zinc-300"
                            />
                            <span>アイコンを変更</span>
                        </Button>
                    </PopoverClose>

                    <PopoverClose>
                        <Button
                            variant="flat"
                            class="w-full"
                            @click="removeAvatar"
                        >
                            <Icon
                                name="lucide:trash"
                                size="18"
                                class="text-zinc-600 dark:text-zinc-300"
                            />
                            <span>アイコンを削除</span>
                        </Button>
                    </PopoverClose>
                </div>
            </template>
        </Popup>

        <ModalCropAvatar
            v-model="modalCropAvatar"
            :avatar="croppingImage"
            @submit="avatar = $event"
        />
    </div>
</template>
