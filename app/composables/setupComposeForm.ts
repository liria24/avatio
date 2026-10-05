import {
    createDefaultSetupComposeForm,
    setupComposeFormSchema,
    type SetupComposeForm,
} from '@avatio/core/setups'
import { useForm, useSelector } from '@tanstack/vue-form'
import { watch } from 'vue'

export const useSetupComposeForm = (onChange: (values: SetupComposeForm) => void) => {
    const form = useForm({
        defaultValues: createDefaultSetupComposeForm(),
        validators: [{ triggers: ['change'], run: setupComposeFormSchema }],
        onSubmit: () => undefined,
    })
    const values = useSelector(form.atom, (state) => state.values)
    // Form values contain only JSON data, but nested entries can still be Vue proxies.
    watch(values, (next) => onChange(JSON.parse(JSON.stringify(next)) as SetupComposeForm), {
        flush: 'post',
    })

    return { form, values }
}
