import { describe, expect, it } from 'vitest'

import {
    getMaintenanceExitPath,
    getMaintenancePagePath,
    isMaintenancePagePath,
    normalizeMaintenancePath,
} from '../../../server/utils/maintenanceRoute'

describe('maintenanceRoute', () => {
    it('normalizes query strings and trailing slashes', () => {
        expect(normalizeMaintenancePath('/on-maintenance/?foo=bar')).toBe('/on-maintenance')
        expect(normalizeMaintenancePath('/en/on-maintenance/')).toBe('/en/on-maintenance')
        expect(normalizeMaintenancePath('/')).toBe('/')
    })

    it('recognizes default and localized maintenance pages', () => {
        expect(isMaintenancePagePath('/on-maintenance')).toBe(true)
        expect(isMaintenancePagePath('/on-maintenance/')).toBe(true)
        expect(isMaintenancePagePath('/en/on-maintenance')).toBe(true)
        expect(isMaintenancePagePath('/en/on-maintenance/?foo=bar')).toBe(true)
        expect(isMaintenancePagePath('/fr/on-maintenance')).toBe(false)
        expect(isMaintenancePagePath('/items')).toBe(false)
    })

    it('preserves locale prefixes when redirecting into and out of maintenance mode', () => {
        expect(getMaintenancePagePath('/items')).toBe('/on-maintenance')
        expect(getMaintenancePagePath('/en/items')).toBe('/en/on-maintenance')
        expect(getMaintenancePagePath('/fr/items')).toBe('/on-maintenance')
        expect(getMaintenanceExitPath('/on-maintenance')).toBe('/')
        expect(getMaintenanceExitPath('/en/on-maintenance')).toBe('/en')
    })
})
