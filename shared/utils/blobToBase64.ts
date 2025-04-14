export default (blob: Blob): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (!e.target || typeof e.target.result !== 'string') {
                reject(new Error('Failed to convert blob to base64'));
                return;
            }
            resolve(e.target.result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};
