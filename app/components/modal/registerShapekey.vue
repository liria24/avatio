<script lang="ts" setup>
const vis = defineModel<boolean>('visibility', { default: false });
const shapekeys = defineModel<Shapekey[]>('shapekeys', { default: [] });
</script>

<template>
    <Modal v-model="vis">
        <template #header>
            <DialogTitle>
                <UiTitle label="シェイプキー" icon="lucide:diamond" />
            </DialogTitle>
        </template>

        <div class="flex flex-col gap-5">
            <div class="flex items-center gap-2">
                <UiTextinput
                    label="シェイプキー名"
                    placeholder="シェイプキー名"
                    class="grow"
                />
                <Icon name="lucide:minus" class="text-2xl text-primary" />
                <UiNumberField
                    :disable-wheel-change="true"
                    :max="2000"
                    :min="-2000"
                    :step="0.001"
                />
            </div>
        </div>
    </Modal>
</template>
