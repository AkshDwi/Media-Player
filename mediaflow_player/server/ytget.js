/**
 * Talks to the local Python (yt-dlp/pytubefix) sidecar service for
 * everything that touches actual audio/files: downloading, streaming,
 * lyrics, the configurable download directory/format, and library management.
 */
const PY_AUDIO_SERVER_URL = process.env.PY_AUDIO_SERVER_URL || 'http://localhost:5000';

async function callServer(path, options) {
    const res = await fetch(`${PY_AUDIO_SERVER_URL}${path}`, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data.error || `Audio server responded with ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return data;
}

// --- Feature 1: download audio, saved under the song's own title (in
// whatever format is currently configured — see set_settings below) ---
export async function get_yt_audio(yt_url) {
    if (!yt_url) throw new Error('yt_url is required');
    const data = await callServer('/api/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: yt_url }),
    });
    if (!data.audioUrl) throw new Error('Python audio server did not return an audioUrl');
    return {
        audioUrl: data.audioUrl,
        title: data.title || null,
        videoId: data.videoId || null,
        lyrics: data.lyrics || '',
        conversionWarning: data.conversionWarning || null,
        raw: data,
    };
}

// --- Feature 4: stream audio directly without a permanent download ---
export async function get_yt_stream(yt_url) {
    if (!yt_url) throw new Error('yt_url is required');
    const data = await callServer('/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: yt_url }),
    });
    if (!data.audioUrl) throw new Error('Python audio server did not return a stream URL');
    return { audioUrl: data.audioUrl, title: data.title || null, videoId: data.videoId || null, streamed: true, raw: data };
}

// --- Deletes a streamed track's temp file once its stream is over ---
export async function end_yt_stream(videoId) {
    if (!videoId) throw new Error('videoId is required');
    return callServer(`/api/stream/${encodeURIComponent(videoId)}`, { method: 'DELETE' });
}

// --- Feature 2: manual lyrics ---
export async function get_lyrics(videoId) {
    return callServer(`/api/lyrics/${encodeURIComponent(videoId)}`);
}

export async function set_lyrics(videoId, lyrics) {
    return callServer(`/api/lyrics/${encodeURIComponent(videoId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lyrics }),
    });
}

// --- Feature 3: custom download location + audio format ---
export async function get_settings() {
    return callServer('/api/settings');
}

// Accepts { downloadDir, audioFormat } — either or both. Kept as an options
// object (rather than positional args) since either field alone is valid.
export async function set_settings({ downloadDir, audioFormat } = {}) {
    if (!downloadDir && !audioFormat) {
        const err = new Error('Provide downloadDir and/or audioFormat');
        err.status = 400;
        throw err;
    }
    const body = {};
    if (downloadDir) body.downloadDir = downloadDir;
    if (audioFormat) body.audioFormat = audioFormat;
    return callServer('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

// --- Converts every already-downloaded song to the currently configured format ---
export async function convert_all_library() {
    return callServer('/api/library/convert-all', { method: 'POST' });
}

// --- Deletes one downloaded song's file (+ metadata) from disk ---
export async function delete_library_item(videoId) {
    if (!videoId) throw new Error('videoId is required');
    return callServer(`/api/library/${encodeURIComponent(videoId)}`, { method: 'DELETE' });
}

// --- Wipes every downloaded song + anything left in temp ---
export async function clear_library() {
    return callServer('/api/library/clear', { method: 'POST' });
}