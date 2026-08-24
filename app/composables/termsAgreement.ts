export const useTermsAgreement = () => {
    const { user, updateUser, fetchSession } = useUserSession()
    const agreeTerms = useAgreeTermsModal()

    const { data: termsContent } = useAvatioContent('terms', 'ja')
    const { data: privacyContent } = useAvatioContent('privacy-policy', 'ja')
    const contents = computed(() => ({
        termsUpdatedAt: termsContent.value?.frontmatter.updatedAt ?? null,
        privacyUpdatedAt: privacyContent.value?.frontmatter.updatedAt ?? null,
    }))

    const lastAgreed = computed(() =>
        user.value?.lastAgreedToTerms ? new Date(user.value.lastAgreedToTerms) : null,
    )

    const needsTerms = computed(() => {
        if (!user.value || !contents.value?.termsUpdatedAt) return false
        return !lastAgreed.value || lastAgreed.value < new Date(contents.value.termsUpdatedAt)
    })

    const needsPrivacyPolicy = computed(() => {
        if (!user.value || !contents.value?.privacyUpdatedAt) return false
        return !lastAgreed.value || lastAgreed.value < new Date(contents.value.privacyUpdatedAt)
    })

    const needsAgreement = computed(() => needsTerms.value || needsPrivacyPolicy.value)

    const agree = async () => {
        await updateUser({ lastAgreedToTerms: new Date() })
        await fetchSession({ force: true })
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
