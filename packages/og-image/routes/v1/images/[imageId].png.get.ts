import { getImage } from '@src/worker'
import { defineEventHandler, getRouterParam, type H3Event } from 'h3'

const getImageId = (event: H3Event) =>
    getRouterParam(event, 'imageId') ??
    getRouterParam(event, 'imageId.png') ??
    event.path.split('?')[0]?.split('/').pop() ??
    ''

export default defineEventHandler((event) => {
    return getImage({
        imageId: getImageId(event),
    })
})
