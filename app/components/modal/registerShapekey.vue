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

        <div class="flex flex-col gap-5"></div>
    </Modal>
</template>
