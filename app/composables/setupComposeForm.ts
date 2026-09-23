import {
    createDefaultSetupComposeForm,
    setupComposeFormSchema,
    type SetupComposeForm,
} from '@avatio/core/setups'
import { useForm, useSelector } from '@tanstack/vue-form'
import { toRaw, watch } from 'vue'

export const useSetupComposeForm = (onChange: (values: SetupComposeForm) => void) => {
    const form = useForm({
        defaultValues: createDefaultSetupComposeForm(),
        validators: [{ triggers: ['change'], run: setupComposeFormSchema }],
        onSubmit: () => undefined,
    })
    const values = useSelector(form.atom, (state) => state.values)
    watch(values, (next) => onChange(structuredClone(toRaw(next))), { flush: 'post' })

    return { form, values }
}
