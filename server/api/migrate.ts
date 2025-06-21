import database from '@@/database'
import {
    account,
    items,
    setupCoauthors,
    setupImages,
    setupItems,
    setupItemShapekeys,
    setups,
    setupTags,
    shops,
    user,
} from '@@/database/schema'
import { createClient } from '@supabase/supabase-js'

type User = {
    id: string
    aud: string
    role: string
    email: string
    email_confirmed_at: string
    phone: string
    confirmed_at: string
    last_sign_in_at: string
    app_metadata: {
        provider: string
        providers: string[]
    }
    user_metadata: {
        avatar_url: string
        email: string
        email_verified: boolean
        full_name: string
        iss: string
        name: string
        phone_verified: boolean
        picture: string
        preferred_username: string
        provider_id: string
        sub: string
        user_name: string
    }
    created_at: string
    updated_at: string
    is_anonymous: boolean
}

const migrateFromSupabase = async () => {
    const supabase = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    )
    const adminAuthClient = supabase.auth.admin

    const usersAuth = (await adminAuthClient.listUsers()).data.users as User[]
    const usersPublic = (
        await supabase
            .from('users')
            .select(
                'id, name, avatar, bio, links, official, user_badges(name, created_at), user_shops(created_at, shop_id)'
            )
    ).data

    const usersMerged = usersAuth
        .filter((user) => user.app_metadata.provider === 'twitter')
        .map((user) => {
            const userPublic = usersPublic?.find((u) => u.id === user.id)

            return {
                id: user.id,
                email: user.email || '',
                name: userPublic?.name || null,
                image: userPublic?.avatar
                    ? `https://images.avatio.me/avatar/${userPublic.avatar}`
                    : user.user_metadata.avatar_url || null,
                bio: userPublic?.bio || null,
                links: userPublic?.links || null,
                official: userPublic?.official || false,
                createdAt: new Date(user.created_at).toISOString(),
                updatedAt: new Date(user.updated_at).toISOString(),
                badges: (userPublic?.user_badges || []) as {
                    name: string
                    created_at: string
                }[],
                shops: (userPublic?.user_shops || []) as {
                    created_at: string
                    shop_id: string
                }[],
                providerId: user.app_metadata.provider,
                accountId: user.user_metadata.sub,
            }
        })

    const resultUsers = await database
        .insert(user)
        .values(
            usersMerged.map((user) => ({
                id: user.id,
                email: user.email,
                name: user.name,
                image: user.image,
                bio: user.bio,
                links: user.links,
                createdAt: new Date(user.createdAt),
                updatedAt: new Date(user.updatedAt),
            }))
        )
        .onConflictDoNothing()
        .returning()
    await database
        .insert(account)
        .values(
            usersMerged.map((user) => ({
                id: user.id,
                userId: user.id,
                providerId: user.providerId,
                accountId: user.accountId,
                createdAt: new Date(user.createdAt),
                updatedAt: new Date(user.updatedAt),
            }))
        )
        .onConflictDoNothing()

    const shopsSupabase = (
        await supabase
            .from('shops')
            .select('id, created_at, updated_at, name, verified, thumbnail')
    ).data
    if (!shopsSupabase) throw new Error('Failed to fetch shops from Supabase')

    await database
        .insert(shops)
        .values(
            shopsSupabase.map((shop) => ({
                id: shop.id,
                createdAt: new Date(shop.created_at),
                updatedAt: new Date(shop.updated_at),
                platform: 'booth' as const,
                name: shop.name,
                verified: shop.verified,
                image: shop.thumbnail,
            }))
        )
        .onConflictDoNothing()

    const itemsSupabase = (
        await supabase
            .from('items')
            .select(
                'id, created_at, updated_at, name, price, thumbnail, nsfw, shop_id, outdated, source, category, likes'
            )
    ).data
    if (!itemsSupabase) throw new Error('Failed to fetch items from Supabase')

    await database
        .insert(items)
        .values(
            itemsSupabase.map((item) => ({
                id: item.id,
                createdAt: new Date(item.created_at),
                updatedAt: new Date(item.updated_at),
                name: item.name,
                price: item.price,
                image: item.thumbnail,
                nsfw: item.nsfw,
                shopId: item.shop_id,
                outdated: item.outdated,
                platform: item.source,
                category:
                    item.category === 'cloth' ? 'clothing' : item.category,
                likes: item.likes,
            }))
        )
        .onConflictDoNothing()

    const setupsSupabase = (
        await supabase.from('setups').select(
            `
            id,
            created_at,
            name,
            description,
            author,
            unity,
            setup_tags(
                tag
            ),
            setup_images(
                name,
                width,
                height
            ),
            setup_coauthors(
                user_id,
                note
            ),
            setup_items(
                item_id,
                note,
                unsupported,
                category,
                setup_item_shapekeys(
                    name,
                    value
                )
            )
            `
        )
    ).data
    if (!setupsSupabase) throw new Error('Failed to fetch setups from Supabase')

    for (const setup of setupsSupabase) {
        const resSetup = await database
            .insert(setups)
            .values({
                id: setup.id,
                createdAt: new Date(setup.created_at),
                updatedAt: new Date(setup.created_at),
                userId: setup.author,
                name: setup.name,
                description: setup.description,
            })
            .onConflictDoNothing()
            .returning({ id: setups.id })
        if (resSetup[0]) {
            if (setup.setup_tags.length)
                await database
                    .insert(setupTags)
                    .values(
                        setup.setup_tags.map((tag) => ({
                            setupId: resSetup[0].id,
                            tag: tag.tag,
                        }))
                    )
                    .onConflictDoNothing()
            if (setup.setup_images.length)
                await database
                    .insert(setupImages)
                    .values(
                        setup.setup_images.map((image) => ({
                            setupId: resSetup[0].id,
                            url: `https://images.avatio.me/setup/${image.name}`,
                            width: image.width,
                            height: image.height,
                        }))
                    )
                    .onConflictDoNothing()
            if (setup.setup_coauthors.length)
                await database
                    .insert(setupCoauthors)
                    .values(
                        setup.setup_coauthors.map((coauthor) => ({
                            setupId: resSetup[0].id,
                            userId: coauthor.user_id,
                            note: coauthor.note || null,
                        }))
                    )
                    .onConflictDoNothing()
            for (const item of setup.setup_items) {
                const resItem = await database
                    .insert(setupItems)
                    .values({
                        setupId: resSetup[0].id,
                        itemId: item.item_id,
                        note: item.note || null,
                        unsupported: item.unsupported || false,
                        category:
                            item.category === 'cloth'
                                ? 'clothing'
                                : item.category,
                    })
                    .onConflictDoNothing()
                    .returning({ id: setupItems.id })
                if (item.setup_item_shapekeys?.length) {
                    await database
                        .insert(setupItemShapekeys)
                        .values(
                            item.setup_item_shapekeys.map((shapekey) => ({
                                setupItemId: resItem[0].id,
                                name: shapekey.name,
                                value: shapekey.value,
                            }))
                        )
                        .onConflictDoNothing()
                }
            }
        }
    }

    return resultUsers
}

export default defineEventHandler(async () => {
    try {
        return await migrateFromSupabase()
    } catch (error) {
        console.error('Migration failed:', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Migration failed',
        })
    }
})
