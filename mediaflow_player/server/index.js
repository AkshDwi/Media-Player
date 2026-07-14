import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import YTMusic from 'ytmusic-api';
import { get_yt_audio } from './ytget.js';

const app = express();
app.use(cors());
app.use(express.json());

// One shared YouTube Music client, initialized once at startup.
const ytmusic = new YTMusic();
await ytmusic.initialize();

// --- Search YouTube Music for a song by text query ---
app.get('/api/search', async (req, res) => {
    const q = (req.query.q || '').toString().trim();
    if (!q) return res.status(400).json({ error: 'Missing query parameter "q"' });

    try {
        const songs = await ytmusic.searchSongs(q);
        const mapped = songs.slice(0, 10).map(s => ({
            id: s.videoId,
            title: s.name,
            channel: s.artist?.name || (Array.isArray(s.artists) ? s.artists.map(a => a.name).join(', ') : '') || 'Unknown',
            duration: s.duration ? formatDuration(s.duration) : '',
            thumbnail: s.thumbnails?.[s.thumbnails.length - 1]?.url || null,
            url: `https://www.youtube.com/watch?v=${s.videoId}`,
        }));
        res.json({ results: mapped });
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ error: 'Search failed' });
    }
});

function formatDuration(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

const PY_AUDIO_SERVER_URL = process.env.PY_AUDIO_SERVER_URL || 'http://localhost:5000';

// --- Download audio for a given YouTube URL via the local Python (pytubefix) service ---
app.post('/api/download', async (req, res) => {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: 'Missing "url" in request body' });

    try {
        const result = await get_yt_audio(url);
        res.json(result);
    } catch (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: err.message || 'Download failed' });
    }
});

// --- List everything already downloaded, so the frontend can auto-import it ---
app.get('/api/library', async (req, res) => {
    try {
        const r = await fetch(`${PY_AUDIO_SERVER_URL}/api/library`);
        const data = await r.json();
        res.json(data);
    } catch (err) {
        console.error('Library fetch error:', err);
        res.status(500).json({ error: 'Could not reach the audio server for the library list' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`ytget server listening on http://localhost:${PORT}`);
});