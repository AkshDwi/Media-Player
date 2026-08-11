import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import YTMusic from 'ytmusic-api';
import LiteYTMusic from 'lite-ytmusic-api';
import { get_yt_audio, get_yt_stream, end_yt_stream, get_lyrics, set_lyrics, get_settings, set_settings, delete_library_item, clear_library } from './ytget.js';

const app = express();
app.use(cors());
app.use(express.json());

// One shared YouTube Music client, initialized once at startup (search).
const ytmusic = new YTMusic();
await ytmusic.initialize();

// Second client, used only for genuine "up next" recommendations — this is
// the same radio/autoplay queue YouTube Music itself builds when you press
// play, not a same-artist search, so it actually returns *similar* songs.
const liteYtmusic = new LiteYTMusic();
await liteYtmusic.initialize();

function mapSong(s) {
    return {
        id: s.videoId,
        title: s.name,
        channel: s.artist?.name || (Array.isArray(s.artists) ? s.artists.map(a => a.name).join(', ') : '') || 'Unknown',
        artistId: s.artist?.artistId || (Array.isArray(s.artists) ? s.artists[0]?.artistId : null) || null,
        duration: s.duration ? formatDuration(s.duration) : '',
        thumbnail: s.thumbnails?.[s.thumbnails.length - 1]?.url || null,
        url: `https://www.youtube.com/watch?v=${s.videoId}`,
    };
}

// "Up next" results have a slightly different shape than search results
// depending on the response, so this is deliberately tolerant of missing fields.
function mapUpNext(s) {
    const videoId = s.videoId || s.id;
    const artists = Array.isArray(s.artists) ? s.artists.map(a => a.name || a).join(', ') : (s.artist?.name || s.artist || '');
    const artistId = s.artist?.artistId || (Array.isArray(s.artists) ? s.artists[0]?.artistId : null) || null;
    return {
        id: videoId,
        title: s.title || s.name || 'Unknown title',
        channel: artists || 'Unknown',
        artistId,
        duration: typeof s.duration === 'number' ? formatDuration(s.duration) : (s.duration || ''),
        thumbnail: s.thumbnails?.[s.thumbnails.length - 1]?.url || s.thumbnail || null,
        url: `https://www.youtube.com/watch?v=${videoId}`,
    };
}

// --- Search YouTube Music for a song by text query ---
// Defensive mappers — the wrapper's field names vary a bit between search
// results and full detail lookups (name vs title, songs vs tracks, etc.).
function pickThumb(obj) {
    const arr = obj?.thumbnails;
    return Array.isArray(arr) && arr.length ? arr[arr.length - 1]?.url : (obj?.thumbnail || null);
}

function mapAlbumResult(a) {
    return {
        id: a.albumId || a.browseId || a.playlistId,
        title: a.name || a.title,
        artist: a.artist?.name || (Array.isArray(a.artists) ? a.artists.map(x => x.name || x).join(', ') : '') || 'Unknown',
        year: a.year || null,
        thumbnail: pickThumb(a),
    };
}

function mapArtistResult(a) {
    return {
        id: a.artistId || a.browseId || a.channelId,
        name: a.name || a.title,
        thumbnail: pickThumb(a),
    };
}

function mapAlbumTrack(s, fallbackArtist, fallbackArtistId) {
    return {
        id: s.videoId || s.id,
        title: s.name || s.title,
        channel: s.artist?.name || fallbackArtist || 'Unknown',
        artistId: s.artist?.artistId || fallbackArtistId || null,
        thumbnail: pickThumb(s) || null,
        duration: typeof s.duration === 'number' ? formatDuration(s.duration) : (s.duration || ''),
        url: `https://www.youtube.com/watch?v=${s.videoId || s.id}`,
    };
}

app.get('/api/search', async (req, res) => {
    const q = (req.query.q || '').toString().trim();
    if (!q) return res.status(400).json({ error: 'Missing query parameter "q"' });

    try {
        const songs = await ytmusic.searchSongs(q);
        res.json({ results: songs.slice(0, 10).map(mapSong) });
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ error: 'Search failed' });
    }
});

// --- Search by album ---
app.get('/api/search/albums', async (req, res) => {
    const q = (req.query.q || '').toString().trim();
    if (!q) return res.status(400).json({ error: 'Missing query parameter "q"' });
    try {
        const albums = await ytmusic.searchAlbums(q);
        res.json({ results: albums.slice(0, 10).map(mapAlbumResult) });
    } catch (err) {
        console.error('Album search error:', err);
        res.status(500).json({ error: 'Album search failed' });
    }
});

// --- Search by artist ---
app.get('/api/search/artists', async (req, res) => {
    const q = (req.query.q || '').toString().trim();
    if (!q) return res.status(400).json({ error: 'Missing query parameter "q"' });
    try {
        const artists = await ytmusic.searchArtists(q);
        res.json({ results: artists.slice(0, 10).map(mapArtistResult) });
    } catch (err) {
        console.error('Artist search error:', err);
        res.status(500).json({ error: 'Artist search failed' });
    }
});

// --- Full track listing for an album, so it can be browsed/downloaded whole ---
app.get('/api/album/:albumId', async (req, res) => {
    try {
        const album = await ytmusic.getAlbum(req.params.albumId);
        const artistName = album.artist?.name || (Array.isArray(album.artists) ? album.artists.map(a => a.name).join(', ') : '');
        const artistId = album.artist?.artistId || null;
        const tracks = (album.songs || album.tracks || []).map(s => mapAlbumTrack(s, artistName, artistId));
        res.json({
            id: req.params.albumId,
            title: album.name || album.title,
            artist: artistName || 'Unknown',
            artistId,
            year: album.year || null,
            thumbnail: pickThumb(album),
            tracks,
        });
    } catch (err) {
        // ytmusic-api validates YouTube's raw response against a strict schema,
        // and real-world listings occasionally have a field missing that the
        // schema requires (e.g. a single with no albumId) — that's a library
        // limitation, not something wrong on this end. Log a one-liner instead
        // of the whole validation error object, and fail cleanly.
        console.error('Album lookup failed:', err?.message || err);
        res.status(500).json({ error: 'Could not load that album (YouTube returned data this library couldn\'t fully parse — try a different album, or try again later).' });
    }
});

// --- Top songs for an artist (YouTube Music's small curated "Top Songs"
// preview — typically ~5), plus their albums/singles so the frontend can
// fetch full tracklists on demand ("Show more") instead of being stuck
// with just that curated handful. ---
app.get('/api/artist/:artistId', async (req, res) => {
    try {
        const artist = await ytmusic.getArtist(req.params.artistId);
        const songs = (artist.songs?.results || artist.songs || artist.topSongs || []).map(s => mapAlbumTrack(s, artist.name, req.params.artistId));
        const albums = (artist.albums?.results || artist.albums || artist.topAlbums || []).map(mapAlbumResult);
        const singles = (artist.singles?.results || artist.singles || artist.topSingles || []).map(mapAlbumResult);
        res.json({
            id: req.params.artistId,
            name: artist.name || artist.title,
            thumbnail: pickThumb(artist),
            songs,
            albums,
            singles,
        });
    } catch (err) {
        console.error('Artist lookup failed (falling back to search):', err?.message || err);
        // getArtist() fails whenever ANY item in the artist's full catalog
        // (including albums/singles/videos/playlists) doesn't match the
        // library's strict schema — even though we only need topSongs. Rather
        // than lose the feature entirely, fall back to a plain song search
        // for this artist's name, which doesn't hit that validation at all.
        try {
            const nameGuess = (req.query.name || '').toString().trim();
            if (!nameGuess) throw new Error('no fallback name available');
            const songs = await ytmusic.searchSongs(nameGuess);
            res.json({
                id: req.params.artistId,
                name: nameGuess,
                thumbnail: null,
                songs: songs.slice(0, 15).map(s => mapAlbumTrack(s, nameGuess, req.params.artistId)),
                albums: [],
                singles: [],
                partial: true, // frontend can note this is a best-effort list
            });
        } catch (fallbackErr) {
            res.status(500).json({ error: 'Could not load that artist (YouTube returned data this library couldn\'t fully parse — try again later).' });
        }
    }
});

// --- Feature 8: real "similar songs" — YouTube Music's own up-next/radio
// queue for this track, not a same-artist search (which just returns other
// songs by that one artist and calling it "similar" was the whole bug). ---
app.get('/api/related', async (req, res) => {
    const videoId = (req.query.videoId || '').toString().trim();
    const title = (req.query.title || '').toString().trim();
    const artist = (req.query.artist || '').toString().trim();

    try {
        let seedId = videoId;
        if (!seedId) {
            // Fallback for streamed tracks that somehow lack a videoId: resolve one via search.
            const seed = `${title} ${artist}`.trim();
            if (!seed) return res.status(400).json({ error: 'Missing "videoId" (or "title"/"artist") query parameter' });
            const found = await ytmusic.searchSongs(seed);
            seedId = found[0]?.videoId;
            if (!seedId) return res.json({ results: [] });
        }

        const upNext = await liteYtmusic.getUpNexts(seedId);
        const mapped = upNext
            .filter(s => (s.videoId || s.id) && (s.videoId || s.id) !== seedId)
            .slice(0, 10)
            .map(mapUpNext);
        res.json({ results: mapped });
    } catch (err) {
        console.error('Related error:', err);
        res.status(500).json({ error: 'Could not find related songs' });
    }
});

function formatDuration(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

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

// --- Feature 4: stream a song's audio directly, no download ---
app.post('/api/stream', async (req, res) => {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: 'Missing "url" in request body' });

    try {
        const result = await get_yt_stream(url);
        res.json(result);
    } catch (err) {
        console.error('Stream error:', err);
        res.status(500).json({ error: err.message || 'Stream failed' });
    }
});

// --- Feature 4: called once a streamed track's playback is over, to delete
// its temp file. Best-effort — failures here shouldn't surface to the user. ---
app.delete('/api/stream/:videoId', async (req, res) => {
    try {
        res.json(await end_yt_stream(req.params.videoId));
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message || 'Could not clean up stream' });
    }
});

// --- Feature 2: manual lyrics, per downloaded video id ---
app.get('/api/lyrics/:videoId', async (req, res) => {
    try {
        res.json(await get_lyrics(req.params.videoId));
    } catch (err) {
        res.status(500).json({ error: err.message || 'Could not load lyrics' });
    }
});

app.post('/api/lyrics/:videoId', async (req, res) => {
    try {
        res.json(await set_lyrics(req.params.videoId, req.body?.lyrics || ''));
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message || 'Could not save lyrics' });
    }
});

// --- Feature 3: custom download location ---
app.get('/api/settings', async (req, res) => {
    try {
        res.json(await get_settings());
    } catch (err) {
        res.status(500).json({ error: err.message || 'Could not load settings' });
    }
});

app.post('/api/settings', async (req, res) => {
    try {
        res.json(await set_settings(req.body?.downloadDir));
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message || 'Could not update settings' });
    }
});

// --- Feature 6/7: list everything already downloaded (this doubles as the
// "Auto Import" playlist on the frontend) ---
app.get('/api/library', async (req, res) => {
    try {
        const r = await fetch(`${process.env.PY_AUDIO_SERVER_URL || 'http://localhost:5000'}/api/library`);
        const data = await r.json();
        res.json(data);
    } catch (err) {
        console.error('Library fetch error:', err);
        res.status(500).json({ error: 'Could not reach the audio server for the library list' });
    }
});

// --- Deletes one downloaded song's file from disk ---
app.delete('/api/library/:videoId', async (req, res) => {
    try {
        res.json(await delete_library_item(req.params.videoId));
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message || 'Could not delete file' });
    }
});

// --- Settings: clears every downloaded song + anything left in temp ---
app.post('/api/library/clear', async (req, res) => {
    try {
        res.json(await clear_library());
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message || 'Could not clear downloads' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`ytget server listening on http://localhost:${PORT}`);
});