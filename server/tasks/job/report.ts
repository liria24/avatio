export default defineTask({
    meta: {
        name: 'job:report',
        description: 'Send daily report to bots',
    },
    async run() {
        const result = await runReportJob()
        return { result }
    },
})
