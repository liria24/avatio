export interface Toast {
    id: string
    title: string
    description?: string
}
export const toasts = ref<Toast[]>([])

export const useToast = () => {
    const add = (title: string, description?: string) => {
        toasts.value.push({ id: useId(), title, description })
    }
    const remove = (id: string) => {
        toasts.value = toasts.value.filter((toast) => toast.id !== id)
    }

    const clear = () => {
        toasts.value = []
    }

    return { add, remove, clear }
}
