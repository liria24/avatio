<script lang="ts" setup>
const emit = defineEmits(['add']);

const inputUrl = ref<string>('');
const adding = ref(false);

const pasteFromClipboard = async () => {
    try {
        const text = await navigator.clipboard.readText();
        inputUrl.value = text;
    } catch (err) {
        console.error('Failed to read clipboard contents: ', err);
    }
};

const addItemFromURL = async () => {
    if (!inputUrl.value) return useToast().add('URLを入力してください。');

    try {
        const url = new URL(inputUrl.value);

        if (url.hostname.split('.').slice(-2).join('.') !== 'booth.pm')
            throw new Error();

        const id = url.pathname.split('/').slice(-1)[0];

        if (!id || !Number.isInteger(Number(id))) throw new Error();

        emit('add', Number(id));
    } catch {
        return useToast().add('無効なURLです。');
    }
};
</script>

<template>
    <div
        :class="[
            'px-5 py-4 rounded-2xl flex flex-col gap-2',
            'ring-1 ring-zinc-300 dark:ring-zinc-700',
            'bg-zinc-100 dark:bg-zinc-900',
            'shadow-xl shadow-black/10 dark:shadow-black/50',
        ]"
    >
        <label for="url" class="text-sm text-zinc-600 dark:text-zinc-400">
            URLから追加
        </label>
        <UiTextinput
            v-model="inputUrl"
            :disabled="adding"
            autocomplete="off"
            placeholder="アイテムのURLを入力"
            icon="lucide:link"
            unstyled
            class="w-full text-sm"
            @keyup.enter="addItemFromURL"
        >
            <template #trailing>
                <Button
                    v-if="!inputUrl"
                    icon="lucide:clipboard"
                    variant="flat"
                    class="p-1.5"
                    @click="pasteFromClipboard"
                />
                <Button
                    v-if="inputUrl !== ''"
                    icon="lucide:x"
                    variant="flat"
                    class="p-1.5"
                    @click="inputUrl = ''"
                />
                <Button
                    :disabled="!inputUrl"
                    icon="lucide:plus"
                    variant="flat"
                    class="p-1.5 enabled:bg-zinc-600 enabled:dark:bg-zinc-300 enabled:hover:bg-zinc-400 enabled:hover:dark:bg-zinc-500 enabled:text-zinc-100 enabled:dark:text-zinc-900"
                    @click="addItemFromURL"
                />
            </template>
        </UiTextinput>
    </div>
</template>
