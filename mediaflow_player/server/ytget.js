/**
 * Downloads the audio for a given YouTube video URL by calling the local
 * Python (pytubefix) sidecar service instead of a paid Apify actor.
 * Returns { audioUrl, title, raw } on success, throws on failure.
 */
const PY_AUDIO_SERVER_URL = process.env.PY_AUDIO_SERVER_URL || 'http://localhost:5000';

export async function get_yt_audio(yt_url) {
    if (!yt_url) throw new Error('yt_url is required');

    const res = await fetch(`${PY_AUDIO_SERVER_URL}/api/audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: yt_url }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data.error || `Audio server responded with ${res.status}`);
    }
    if (!data.audioUrl) {
        throw new Error('Python audio server did not return an audioUrl');
    }

    return {
        audioUrl: data.audioUrl,
        title: data.title || null,
        raw: data,
    };
}