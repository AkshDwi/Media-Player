import { ApifyClient } from 'apify-client';
export function get_yt_audio(yt_url) {

    const client = new ApifyClient({
        token: process.env.APIFY_KEY,
    });

    const input = {
        "videos": [
            {
                "url": yt_url
            }
        ],
        "preferredQuality": "720p",
        "preferredFormat": "mp3",
        "filenameTemplateParts": [
            "title"
        ],
        "s3Bucket": "my-video-bucket",
        "s3Region": "us-west-1",
        "azureContainerName": "my-video-container",
        "googleCloudBucketName": "my-video-bucket"
    };

    (async () => {
        const run = await client.actor("UUhJDfKJT2SsXdclR").call(input);

        console.log('Results from dataset');
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        items.forEach((item) => {
            console.dir(item);
        });
    })();
}