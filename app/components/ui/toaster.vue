<template>
    <ToastProvider>
        <UiToast
            v-for="toast in toasts"
            :key="toast.id"
            :title="toast.title"
            :description="toast.description"
        />
        <ToastViewport
            class="fixed right-0 bottom-0 z-[2147483647] flex list-none flex-col items-end gap-2 p-3"
        />
    </ToastProvider>
</template>
