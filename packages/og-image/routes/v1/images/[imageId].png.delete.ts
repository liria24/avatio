import { cleanupImage } from '@src/worker'
import { defineEventHandler } from 'h3'

export default defineEventHandler(cleanupImage)
