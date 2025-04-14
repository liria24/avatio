import { createStorage } from 'unstorage';
import s3Driver from 'unstorage/drivers/s3';

const runtime = useRuntimeConfig();

export default () =>
    createStorage({
        driver: s3Driver({
            accessKeyId: runtime.r2.accessKey,
            secretAccessKey: runtime.r2.secretKey,
            endpoint: runtime.r2.endpoint,
            bucket: 'avatio',
            region: 'auto',
        }),
    });
