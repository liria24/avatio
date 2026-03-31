import consola from 'consola'

export const logger = (tag: string) => consola.withTag(tag)
