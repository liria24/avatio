import { z } from 'zod/v4'

const body = z.object({
    deleteAvatar: z.boolean().nullable(),
    name: z
        .string()
        .min(1, 'Please enter a username')
        .max(124, 'Username must be within 124 characters')
        .refine(
            (name) => !/^\s+$/.test(name),
            'Username cannot contain only whitespace'
        ),
    bio: z.string().max(140, 'Bio must be within 140 characters').nullable(),
    links: z
        .array(z.string().url('Please enter a valid URL'))
        .max(8, 'You can add up to 8 links'),
    newAvatar: z
        .string()
        .refine(
            (img) =>
                Buffer.from(img.split(',')[1] || img, 'base64').length <=
                2 * 1024 * 1024,
            'Image is too large.'
        )
        .nullable(),
})

export default defineEventHandler(async () => {
    const event = useEvent()

    // Authenticate user
    const user = await checkSupabaseUser()
    const supabase = await getSupabaseServiceRoleClient()

    const { deleteAvatar, name, bio, links, newAvatar } =
        await validateBody(body)

    // Get current user data
    const { data: oldUserData, error: fetchError } = await supabase
        .from('users')
        .select('name, avatar, bio, links')
        .eq('id', user.id)
        .single()

    if (fetchError || !oldUserData) {
        console.error('User not found:', user.id, fetchError)
        throw createError({
            statusCode: 404,
            message: 'User not found.',
        })
    }

    // Handle avatar deletion (note: avatar deletion ignores field updates as per requirements)
    if (deleteAvatar) {
        try {
            await event.$fetch('/api/image', {
                method: 'DELETE',
                query: {
                    name: oldUserData.avatar,
                    prefix: 'avatar',
                },
            })
        } catch (error) {
            console.error('Error deleting avatar:', error)
            throw createError({
                statusCode: 500,
                message: 'Error deleting avatar.',
            })
        }

        const { data, error } = await supabase
            .from('users')
            .update({
                name: oldUserData.name,
                bio: oldUserData.bio,
                avatar: null,
                links: oldUserData.links,
            })
            .eq('id', user.id)
            .select()
            .single()

        if (error) {
            console.error('Error deleting user avatar:', error)
            throw createError({
                statusCode: 500,
                message: 'Error deleting user avatar.',
            })
        }

        return {
            name: data.name,
            bio: data.bio,
            avatar: data.avatar,
            links: data.links,
        }
    }

    // Handle new avatar upload
    if (newAvatar) {
        try {
            const response = await event.$fetch('/api/image', {
                method: 'POST',
                body: {
                    image: newAvatar,
                    prefix: 'avatar',
                },
            })

            const { data, error } = await supabase
                .from('users')
                .update({
                    name,
                    bio,
                    avatar: response.name,
                    links,
                })
                .eq('id', user.id)
                .select()
                .single()

            if (error) {
                console.error('Error updating user with new avatar:', error)
                throw createError({
                    statusCode: 500,
                    message: 'Error updating user.',
                })
            }

            return {
                name: data.name,
                bio: data.bio,
                avatar: data.avatar,
                links: data.links,
            }
        } catch (error) {
            console.error('Error uploading avatar:', error)
            throw createError({
                statusCode: 500,
                message: 'Error uploading avatar.',
            })
        }
    }

    // Update user without changing avatar
    const { data, error } = await supabase
        .from('users')
        .update({
            name,
            bio,
            avatar: oldUserData.avatar,
            links,
        })
        .eq('id', user.id)
        .select()
        .single()

    if (error) {
        console.error('Error updating user:', error)
        throw createError({
            statusCode: 500,
            message: 'Error updating user.',
        })
    }

    const response = {
        name: data.name,
        bio: data.bio,
        avatar: data.avatar,
        links: data.links,
    }

    return response
})
