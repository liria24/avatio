<script lang="ts" setup>
interface Props {
    setupName: string;
    setupDescription: string;
    setupAuthor: string;
    copyUrlButton?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
    copyUrlButton: true,
});

const { share, isSupported } = useShare();

const content = {
    title: encodeURIComponent(props.setupName + ' | ' + props.setupAuthor),
    text: props.setupDescription,
    url: useBrowserLocation().value.href!,
    hashtags: 'avatio',
};

const tweet = `http://x.com/intent/tweet?text=${content.title}&url=${content.url}&hashtags=${content.hashtags}`;
</script>

<template>
    <Popup class="min-w-44 p-1 gap-0.5">
        <template #trigger>
            <slot />
        </template>

        <template #content>
            <ButtonCopyUrl
                v-if="props.copyUrlButton"
                :url="useBrowserLocation().value.href!"
            />

            <Button
                :to="tweet"
                new-tab
                icon="simple-icons:x"
                :icon-size="18"
                label="ポスト"
                variant="flat"
            />
            <Button
                v-if="isSupported"
                icon="lucide:share-2"
                :icon-size="18"
                label="その他"
                variant="flat"
                @click="
                    share({
                        title: content.title,
                        text: content.text,
                        url: content.url,
                    })
                "
            />
        </template>
    </Popup>
</template>
