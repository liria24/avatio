import { z } from 'zod/v4'

const body = z.object({
    adminKey: z
        .string('Admin key is required.')
        .min(1, 'Admin key cannot be empty.'),
})

export default defineEventHandler(async () => {
    const { adminKey } = await validateBody(body)

    const config = useRuntimeConfig()
    if (adminKey !== config.adminKey)
        return {
            error: { status: 403, message: 'Forbidden.' },
            data: null,
        }

    const deleteCompleted = []
    const deleteFailed = []

    const storage = imageStorageClient()
    const supabase = await getSupabaseServerClient()

    const { data, error } = await supabase.from('users').select('avatar')

    if (error) {
        console.error('Error fetching user images from Supabase:', error)
        return
    }

    if (!data) return null
    const userImages = data
        .map((i) => i.avatar)
        .filter((i) => i?.length && i !== null && i !== undefined)

    const storageUserImages = (await storage.keys('avatar'))
        .map((image) => image.split(':').at(-1))
        .filter((image) => image !== undefined && image !== null)

    const unusedImages = storageUserImages.filter(
        (image) => !userImages.includes(image)
    )

    for (const image of unusedImages) {
        const { data, error } = await supabase
            .from('users')
            .select('avatar')
            .eq('avatar', image)
            .maybeSingle()

        if (error) {
            console.error('Error fetching user image from Supabase:', error)
            break
        }

        if (!data) {
            await storage.del(`avatar:${image}`)

            if (await storage.has(`avatar:${image}`)) {
                console.error('Failed to delete image on R2.', image)
                deleteFailed.push(image)
            } else {
                deleteCompleted.push(image)
            }
        }
    }

    return {
        completed: deleteCompleted,
        failed: deleteFailed,
    }
})
