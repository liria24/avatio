export const useTermsAgreement = () => {
    const { session, auth, refreshSession } = useAuth()
    const agreeTerms = useAgreeTermsModal()

    const { data: contents } = useAsyncData('terms-agreement-check', async () => {
        const [termsContent, privacyContent] = await Promise.all([
            queryCollection('content_ja').path('/terms').first(),
            queryCollection('content_ja').path('/privacy-policy').first(),
        ])
        return {
            termsUpdatedAt: termsContent?.updatedAt ?? null,
            privacyUpdatedAt: privacyContent?.updatedAt ?? null,
        }
    })

    const lastAgreed = computed(() =>
        session.value?.user?.lastAgreedToTerms
            ? new Date(session.value.user.lastAgreedToTerms)
            : null,
    )

    const needsTerms = computed(() => {
        if (!session.value?.user || !contents.value?.termsUpdatedAt) return false
        return !lastAgreed.value || lastAgreed.value < new Date(contents.value.termsUpdatedAt)
    })

    const needsPrivacyPolicy = computed(() => {
        if (!session.value?.user || !contents.value?.privacyUpdatedAt) return false
        return !lastAgreed.value || lastAgreed.value < new Date(contents.value.privacyUpdatedAt)
    })

    const needsAgreement = computed(() => needsTerms.value || needsPrivacyPolicy.value)

    const agree = async () => {
        await auth.updateUser({ lastAgreedToTerms: new Date() })
        await refreshSession()
    }

    return {
        needsTerms,
        needsPrivacyPolicy,
        needsAgreement,
        agree,
        open: () =>
            agreeTerms.open({
                needsTerms: needsTerms.value,
                needsPrivacyPolicy: needsPrivacyPolicy.value,
            }),
    }
}
