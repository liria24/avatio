import { isUserSetupImageKey } from '../../../server/utils/setupImages'
describe('setup image key ownership', () => {
    it('accepts only the complete current-user prefix', () => {
        expect(isUserSetupImageKey('setup/user-1/image.jpg', 'user-1')).toBe(true)
        expect(isUserSetupImageKey('setup/user-2/image.jpg', 'user-1')).toBe(false)
        expect(isUserSetupImageKey('setup/user-11/image.jpg', 'user-1')).toBe(false)
    })
})
