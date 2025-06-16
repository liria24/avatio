<script lang="ts" setup>
const vis = defineModel<boolean>('visibility', { default: false })
const shapekeys = defineModel<Shapekey[]>('shapekeys', { default: [] })

const toast = useToast()

const name = ref('')
const value = ref(0)

const register = () => {
    if (!name.value.length) return
    if (name.value.length > setupLimits().shapekeyName) {
        toast.add({
            title: `シェイプキー名は${setupLimits().shapekeyName}文字以内で入力してください`,
            color: 'warning',
        })
        return
    }

    const shapekey = {
        name: name.value,
        value: value.value,
    }

    shapekeys.value.push(shapekey)
    name.value = ''
    value.value = 0
}
</script>

<template>
    <Modal v-model="vis">
        <template #header>
            <DialogTitle>
                <UiTitle label="シェイプキー" icon="lucide:diamond" />
            </DialogTitle>
        </template>

        <div class="flex flex-col gap-5">
            <div class="flex flex-col items-center gap-1">
                <p v-if="!shapekeys.length" class="text-sm text-zinc-400">
                    シェイプキーが登録されていません
                </p>
                <div
                    v-for="(shapekey, index) in shapekeys"
                    :key="index"
                    class="grid w-full grid-cols-2 items-center gap-2"
                >
                    <p
                        class="grow text-right text-sm text-zinc-700 dark:text-zinc-300"
                    >
                        {{ shapekey.name }}
                    </p>
                    <div class="flex items-center gap-2">
                        <Icon
                            name="lucide:minus"
                            size="20"
                            class="text-zinc-600 dark:text-zinc-400"
                        />
                        <p
                            class="grow text-left text-sm text-zinc-700 dark:text-zinc-300"
                        >
                            {{ shapekey.value }}
                        </p>
                        <Button
                            variant="flat"
                            class="p-2"
                            @click="shapekeys.splice(index, 1)"
                        >
                            <Icon
                                name="lucide:x"
                                size="20"
                                class="cursor-pointer text-zinc-400"
                            />
                        </Button>
                    </div>
                </div>
            </div>

            <USeparator />

            <div class="flex flex-col gap-5">
                <div class="flex items-center gap-2">
                    <UiTextinput
                        v-model="name"
                        label="シェイプキー名"
                        placeholder="シェイプキー名"
                        class="grow"
                        @keydown.enter="register"
                    />
                    <Icon name="lucide:minus" class="text-primary text-2xl" />
                    <UiNumberField
                        v-model="value"
                        :disable-wheel-change="true"
                        :max="2000"
                        :min="-2000"
                        :step="0.001"
                        @keydown.enter="register"
                    />
                </div>
            </div>
        </div>
    </Modal>
</template>
