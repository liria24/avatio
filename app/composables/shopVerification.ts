export const useShopVerification = () => {
    const toast = useToast()

    const verify = async (url: string) => {
        try {
            await $fetch('/api/shop-verification', {
                method: 'POST',
                body: { url },
            })
            toast.add({ title: 'ショップを認証しました', color: 'success' })
            return true
        } catch (error) {
            console.error('Error verifying shop:', error)
            toast.add({ title: 'ショップの認証に失敗しました', color: 'error' })
            return false
        }
    }

    const unverify = async (shopId: string) => {
        try {
            await $fetch('/api/shop-verification', {
                method: 'DELETE',
                body: { shopId },
            })
            toast.add({ title: 'ショップの認証を解除しました', color: 'success' })
            return true
        } catch (error) {
            console.error('Error unverifying shop:', error)
            toast.add({ title: 'ショップの認証解除に失敗しました', color: 'error' })
            return false
        }
    }

    const generateVerificationCode = async () => {
        try {
            const data = await $fetch<{ code: string }>('/api/shop-verification/code')
            return data.code
        } catch (error) {
            console.error('Error generating verification code:', error)
            return null
        }
    }

    return {
        verify,
        unverify,
        generateVerificationCode,
    }
}
