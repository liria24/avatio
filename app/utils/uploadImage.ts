export const uploadImage = async (file: File, path: string) => {
    const formData = new FormData()
    formData.append('blob', file)
    formData.append('path', path)

    const response = await $fetch<{ url: string }>('/api/images', {
        method: 'POST',
        body: formData,
    })
    return response.url
}
