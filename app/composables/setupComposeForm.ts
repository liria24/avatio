import {
    createDefaultSetupComposeForm,
    setupComposeFormSchema,
    type SetupComposeForm,
} from '@avatio/core/setups'
import { useForm, useStore } from '@tanstack/vue-form'

export const useSetupComposeForm = (onChange: (values: SetupComposeForm) => void) => {
    const form = useForm({
        defaultValues: createDefaultSetupComposeForm(),
        validators: [{ triggers: ['change'], run: setupComposeFormSchema }],
        onSubmit: () => undefined,
    })
    const values = useStore(form.atom, (state) => state.values)
    watch(values, (next) => onChange(structuredClone(next)), { flush: 'post' })

    return { form, values }
}
