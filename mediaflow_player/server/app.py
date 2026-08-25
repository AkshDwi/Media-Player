import json
import os
import re
import shutil
import subprocess

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from yt_dlp import YoutubeDL

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, expose_headers=["Content-Range", "Accept-Ranges", "Content-Length"])

SERVER_DIR = os.path.dirname(__file__)

# Downloads/temp live somewhere the user can actually find and browse — their
# Music folder — instead of a hidden app-data directory or (worse, once
# packaged) inside the installed app's own read-only/admin-only folder.
# `os.path.expanduser('~/Music')` resolves correctly on Windows, macOS, and
# Linux alike (e.g. C:\Users\<you>\Music, ~/Music, ~/Music).
# MEDIAFLOW_DATA_DIR can still override this if ever needed, but nothing
# sets it by default anymore — this one default now works everywhere.
DEFAULT_DATA_DIR = os.path.join(os.path.expanduser('~/Music'), 'mediaflow_player')
DATA_DIR = os.environ.get('MEDIAFLOW_DATA_DIR') or DEFAULT_DATA_DIR
os.makedirs(DATA_DIR, exist_ok=True)

SETTINGS_PATH = os.path.join(DATA_DIR, 'settings.json')
DEFAULT_DOWNLOAD_DIR = os.path.join(DATA_DIR, 'downloads')


def load_settings():
    if os.path.exists(SETTINGS_PATH):
        try:
            with open(SETTINGS_PATH) as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def save_settings(s):
    try:
        with open(SETTINGS_PATH, 'w') as f:
            json.dump(s, f)
    except Exception:
        pass


_settings = load_settings()
DOWNLOAD_DIR = os.path.abspath(_settings.get('downloadDir') or DEFAULT_DOWNLOAD_DIR)
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

# 'source' = whatever format the download engine naturally gives (webm/m4a,
# no conversion needed, no ffmpeg dependency). Anything else re-encodes via
# ffmpeg after download.
AUDIO_FORMAT = _settings.get('audioFormat') or 'source'
SUPPORTED_FORMATS = ('source', 'webm', 'mp3', 'mp4', 'wav', 'm4a')

# ffmpeg codec args per target format. mp4 here means an AAC-in-MP4
# container (the standard "audio in an mp4 file" setup) — same codec as
# m4a, different container extension.
FORMAT_FFMPEG_ARGS = {
    'mp3': ['-vn', '-codec:a', 'libmp3lame', '-q:a', '2'],
    'wav': ['-vn', '-codec:a', 'pcm_s16le'],
    'm4a': ['-vn', '-codec:a', 'aac', '-b:a', '192k'],
    'mp4': ['-vn', '-codec:a', 'aac', '-b:a', '192k'],
    'webm': ['-vn', '-codec:a', 'libopus', '-b:a', '160k'],
}

# Prefer a bundled ffmpeg binary (via the imageio-ffmpeg package) over
# whatever's on the system PATH — PATH issues are a very common source of
# "ffmpeg not found" even when it's genuinely installed (a terminal/IDE
# opened before the PATH update won't see it until fully restarted, PATH
# scope differs between user/system installs, etc.). A bundled binary
# sidesteps all of that entirely; falling back to PATH only if the package
# isn't installed.
try:
    import imageio_ffmpeg
    _BUNDLED_FFMPEG_PATH = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    _BUNDLED_FFMPEG_PATH = None


def get_ffmpeg_path():
    if _BUNDLED_FFMPEG_PATH and os.path.exists(_BUNDLED_FFMPEG_PATH):
        return _BUNDLED_FFMPEG_PATH
    return shutil.which('ffmpeg')


def ffmpeg_available():
    return get_ffmpeg_path() is not None


def convert_audio_file(src_path, target_ext):
    """Converts src_path to target_ext via ffmpeg, replacing the original on
    success. Returns the new path. Raises if ffmpeg is missing, the target
    format isn't supported, or the conversion itself fails."""
    current_ext = os.path.splitext(src_path)[1].lstrip('.').lower()
    if target_ext == 'source' or target_ext == current_ext:
        return src_path
    if target_ext not in FORMAT_FFMPEG_ARGS:
        raise RuntimeError(f"Unsupported target format: {target_ext}")
    ffmpeg_path = get_ffmpeg_path()
    if not ffmpeg_path:
        raise RuntimeError(
            "ffmpeg isn't available — it's required to convert to "
            f"{target_ext}. 'Source' format needs no conversion and works without it. "
            "Try `pip install imageio-ffmpeg` to get a bundled copy with no PATH setup needed."
        )

    base = os.path.splitext(src_path)[0]
    dst_path = f"{base}.{target_ext}"
    counter = 2
    while os.path.exists(dst_path) and os.path.abspath(dst_path) != os.path.abspath(src_path):
        dst_path = f"{base} ({counter}).{target_ext}"
        counter += 1

    cmd = [ffmpeg_path, '-y', '-i', src_path, *FORMAT_FFMPEG_ARGS[target_ext], dst_path]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0 or not os.path.exists(dst_path):
        raise RuntimeError(f"ffmpeg conversion to {target_ext} failed: {result.stderr[-400:]}")

    os.remove(src_path)
    return dst_path


# --- Feature 4 support: streamed (not "kept") tracks are saved into a
# non-configurable "temp" subfolder of whatever the current download dir is,
# and deleted again as soon as that song's stream is over. This also sidesteps
# handing the browser a raw, short-lived googlevideo CDN URL directly. ---
def temp_dir():
    # Sibling of DOWNLOAD_DIR, not nested inside it — mirrors the same
    # ".../mediaflow_player/downloads" + ".../mediaflow_player/temp"
    # structure, and keeps following DOWNLOAD_DIR if the user changes their
    # download location from Settings.
    d = os.path.join(os.path.dirname(DOWNLOAD_DIR), 'temp')
    os.makedirs(d, exist_ok=True)
    return d


# --- Download engines, tried in order until one works. YouTube regularly
# breaks one extraction method or another (client blocks, signature changes,
# SABR/PoToken rollouts, etc.) — rather than the whole app going down when
# that happens, each engine is a fully independent attempt, so one breaking
# doesn't take the others with it. yt-dlp is tried first (most actively
# maintained), across a few different "player clients" it can pretend to be;
# pytubefix is a genuinely separate codebase used as a last resort, since a
# bug/block in yt-dlp's extractor is unlikely to affect it too. ---
try:
    from pytubefix import YouTube as _PytubefixYouTube
except ImportError:
    _PytubefixYouTube = None


def _ytdlp_engine(player_client=None):
    """Returns an engine function that downloads via yt-dlp, optionally
    pretending to be a specific YouTube client (android/ios/web etc.) —
    some clients succeed where others get blocked."""
    def engine(video_id, out_dir):
        outtmpl = os.path.join(out_dir, f'{video_id}.%(ext)s')
        opts = {
            'format': 'bestaudio/best',
            'outtmpl': outtmpl,
            'noplaylist': True,
            'quiet': True,
            'no_warnings': True,
            'nocheckcertificate': True,
        }
        if player_client:
            opts['extractor_args'] = {'youtube': {'player_client': [player_client]}}
        with YoutubeDL(opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=True)
        ext = info.get('ext', 'webm')
        return f"{video_id}.{ext}", (info.get('title') or video_id)
    return engine


def _pytubefix_engine(video_id, out_dir):
    if _PytubefixYouTube is None:
        raise RuntimeError('pytubefix is not installed')
    yt = _PytubefixYouTube(f"https://www.youtube.com/watch?v={video_id}", client="WEB")
    stream = yt.streams.get_audio_only()
    if not stream:
        raise RuntimeError('pytubefix: no audio-only stream found')
    filename = f"{video_id}.{stream.subtype}"
    stream.download(output_path=out_dir, filename=filename)
    return filename, (yt.title or video_id)


DOWNLOAD_ENGINES = [
    ('yt-dlp (default client)', _ytdlp_engine(None)),
    ('yt-dlp (android client)', _ytdlp_engine('android')),
    ('yt-dlp (ios client)', _ytdlp_engine('ios')),
    ('pytubefix', _pytubefix_engine),
]


def ytdlp_download(video_id, out_dir):
    """Downloads the best available audio for video_id into out_dir as
    '<video_id>.<ext>', trying each engine above in order until one
    succeeds. Returns (filename, title); raises only if all of them fail."""
    last_error = None
    for name, engine in DOWNLOAD_ENGINES:
        try:
            return engine(video_id, out_dir)
        except Exception as e:
            last_error = e
            print(f"[download] engine '{name}' failed for {video_id}: {e}")
            continue
    raise RuntimeError(f"All download engines failed for this video. Last error: {last_error}")


_stream_titles = {}  # video_id -> title, for temp files we've already resolved


def resolve_and_cache_stream(video_id):
    """Resolves the audio for video_id and downloads it into the temp folder
    (reusing an existing temp file for this video if there's already one
    there). Returns (filename, title)."""
    for f in os.listdir(temp_dir()):
        if f.startswith(f"{video_id}."):
            return f, _stream_titles.get(video_id, video_id)

    try:
        filename, title = ytdlp_download(video_id, temp_dir())
        _stream_titles[video_id] = title
        return filename, title
    except Exception as e:
        msg = str(e)
        if 'sign in' in msg.lower() or 'confirm' in msg.lower() or 'bot' in msg.lower():
            raise RuntimeError(
                "YouTube is blocking this download (bot-check) across every fallback "
                "engine. Try updating yt-dlp (`pip install -U yt-dlp`) — it ships fixes "
                "for these very frequently — or try a different track."
            )
        raise RuntimeError(msg)


def delete_temp_for(video_id):
    removed = False
    for f in os.listdir(temp_dir()):
        if f.startswith(f"{video_id}."):
            try:
                os.remove(os.path.join(temp_dir(), f))
                removed = True
            except Exception:
                pass
    _stream_titles.pop(video_id, None)
    return removed


def is_valid_youtube_url(url):
    pattern = r"^(https?://)?(www\.)?(youtube\.com/watch\?v=|youtu\.be/)[\w-]+(&\S*)?$"
    return re.match(pattern, url) is not None


def extract_video_id(url):
    match = re.search(r"(?:v=|youtu\.be/)([\w-]{11})", url)
    return match.group(1) if match else None


def sanitize_filename(name):
    name = re.sub(r'[\\/*?:"<>|]', '', name or '').strip()
    name = re.sub(r'\s+', ' ', name)
    return name[:150] if name else 'untitled'


# --- Metadata (one JSON per video, keyed by video id, independent of the
# audio filename so the audio file can carry the song's real title) ---
def get_meta(video_id):
    meta_path = os.path.join(DOWNLOAD_DIR, f"{video_id}.json")
    if os.path.exists(meta_path):
        try:
            with open(meta_path) as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_meta(video_id, meta):
    meta_path = os.path.join(DOWNLOAD_DIR, f"{video_id}.json")
    try:
        with open(meta_path, 'w') as f:
            json.dump(meta, f)
    except Exception:
        pass


def find_meta_by_filename(filename):
    for jf in os.listdir(DOWNLOAD_DIR):
        if jf.endswith('.json'):
            m = get_meta(jf[:-5])
            if m.get('filename') == filename:
                return jf[:-5], m
    return None, {}


# --- Feature 4: /api/stream downloads the track into downloads/temp/ (a
#     non-configurable subfolder — see temp_dir() above) and hands back a URL
#     to that local file. The frontend calls DELETE on this same route when
#     that song's stream is over, which removes the temp file again.
@app.route('/api/stream', methods=['POST'])
def stream_audio():
    data = request.get_json(silent=True) or {}
    url = data.get('url')
    if not url or not is_valid_youtube_url(url):
        return jsonify({"error": "Invalid YouTube URL."}), 400
    video_id = extract_video_id(url)
    if not video_id:
        return jsonify({"error": "Could not parse a video ID from that URL."}), 400
    try:
        filename, title = resolve_and_cache_stream(video_id)
        return jsonify({
            "audioUrl": f"{request.host_url.rstrip('/')}/temp/{filename}",
            "title": title,
            "videoId": video_id,
            "streamed": True,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/stream/<video_id>', methods=['DELETE'])
def end_stream(video_id):
    removed = delete_temp_for(video_id)
    return jsonify({"ok": True, "removed": removed})


@app.route('/temp/<path:filename>')
def serve_temp(filename):
    return send_from_directory(temp_dir(), filename)


# --- Feature 1: downloaded files are named after the song title ---
@app.route('/api/audio', methods=['POST'])
def download_audio():
    data = request.get_json(silent=True) or {}
    url = data.get('url')

    if not url:
        return jsonify({"error": "Missing 'url' parameter in the request body."}), 400
    if not is_valid_youtube_url(url):
        return jsonify({"error": "Invalid YouTube URL."}), 400

    video_id = extract_video_id(url)
    if not video_id:
        return jsonify({"error": "Could not parse a video ID from that URL."}), 400

    meta = get_meta(video_id)
    existing_filename = meta.get('filename')
    if existing_filename and os.path.exists(os.path.join(DOWNLOAD_DIR, existing_filename)):
        return jsonify({
            "audioUrl": f"{request.host_url.rstrip('/')}/downloads/{existing_filename}",
            "title": meta.get('title'),
            "videoId": video_id,
            "lyrics": meta.get('lyrics', ''),
        }), 200

    try:
        tmp_filename, title = ytdlp_download(video_id, DOWNLOAD_DIR)

        base_name = sanitize_filename(title)
        ext = tmp_filename.rsplit('.', 1)[-1]
        filename = f"{base_name}.{ext}"
        counter = 2
        while os.path.exists(os.path.join(DOWNLOAD_DIR, filename)) and filename != tmp_filename:
            filename = f"{base_name} ({counter}).{ext}"
            counter += 1

        if filename != tmp_filename:
            os.replace(os.path.join(DOWNLOAD_DIR, tmp_filename), os.path.join(DOWNLOAD_DIR, filename))

        # Convert to the configured format (a no-op if AUDIO_FORMAT is
        # 'source' or already matches what was downloaded). If conversion
        # fails (e.g. ffmpeg missing), keep the successfully-downloaded file
        # in its native format rather than losing the whole download over it.
        conversion_warning = None
        try:
            final_path = convert_audio_file(os.path.join(DOWNLOAD_DIR, filename), AUDIO_FORMAT)
            filename = os.path.basename(final_path)
        except Exception as e:
            conversion_warning = str(e)
            print(f"[convert] kept '{filename}' in its original format: {conversion_warning}")

        meta = {
            "title": title,
            "filename": filename,
            "videoId": video_id,
            "lyrics": meta.get('lyrics', ''),
            "source": "youtube",
        }
        save_meta(video_id, meta)

        return jsonify({
            "audioUrl": f"{request.host_url.rstrip('/')}/downloads/{filename}",
            "title": title,
            "videoId": video_id,
            "lyrics": meta.get('lyrics', ''),
            "conversionWarning": conversion_warning,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- Feature 2: manual lyrics, stored per video id, no external API ---
@app.route('/api/lyrics/<video_id>', methods=['GET'])
def get_lyrics(video_id):
    meta = get_meta(video_id)
    return jsonify({"lyrics": meta.get('lyrics', '')})


@app.route('/api/lyrics/<video_id>', methods=['POST'])
def set_lyrics(video_id):
    data = request.get_json(silent=True) or {}
    lyrics = data.get('lyrics', '')
    meta = get_meta(video_id)
    if not meta:
        return jsonify({"error": "No downloaded track with that id yet — lyrics can only be attached to downloaded songs."}), 404
    meta['lyrics'] = lyrics
    save_meta(video_id, meta)
    return jsonify({"ok": True, "lyrics": lyrics})


# --- Feature 3: custom download location, persisted + migrates old files ---
# Also covers the download audio format (webm/mp3/mp4/wav/m4a/source).
@app.route('/api/settings', methods=['GET'])
def get_settings():
    return jsonify({
        "downloadDir": DOWNLOAD_DIR,
        "audioFormat": AUDIO_FORMAT,
        "ffmpegAvailable": ffmpeg_available(),
    })


@app.route('/api/settings', methods=['POST'])
def update_settings():
    global DOWNLOAD_DIR, AUDIO_FORMAT
    data = request.get_json(silent=True) or {}
    new_dir = data.get('downloadDir')
    new_format = data.get('audioFormat')

    if not new_dir and not new_format:
        return jsonify({"error": "Provide 'downloadDir' and/or 'audioFormat'."}), 400

    moved = 0
    if new_dir:
        new_dir = os.path.abspath(os.path.expanduser(new_dir))
        try:
            os.makedirs(new_dir, exist_ok=True)
        except Exception as e:
            return jsonify({"error": f"Could not create/access directory: {e}"}), 400

        if os.path.normcase(new_dir) != os.path.normcase(DOWNLOAD_DIR) and os.path.isdir(DOWNLOAD_DIR):
            for f in os.listdir(DOWNLOAD_DIR):
                src = os.path.join(DOWNLOAD_DIR, f)
                dst = os.path.join(new_dir, f)
                if os.path.isfile(src) and not os.path.exists(dst):
                    shutil.move(src, dst)
                    moved += 1

        DOWNLOAD_DIR = new_dir
        _settings['downloadDir'] = DOWNLOAD_DIR

    if new_format:
        if new_format not in SUPPORTED_FORMATS:
            return jsonify({"error": f"Unsupported format '{new_format}'. Choose from: {', '.join(SUPPORTED_FORMATS)}."}), 400
        AUDIO_FORMAT = new_format
        _settings['audioFormat'] = AUDIO_FORMAT

    save_settings(_settings)
    return jsonify({
        "downloadDir": DOWNLOAD_DIR,
        "audioFormat": AUDIO_FORMAT,
        "movedFiles": moved,
        "ffmpegAvailable": ffmpeg_available(),
    })


# --- Converts every already-downloaded song to whatever AUDIO_FORMAT is
# currently set to. Skips files already in that format. Best-effort per
# file — one bad file doesn't stop the rest of the library. ---
@app.route('/api/library/convert-all', methods=['POST'])
def convert_all_library():
    if AUDIO_FORMAT == 'source':
        return jsonify({"error": "Format is set to 'Source' (no conversion) — pick a specific format first."}), 400
    if not ffmpeg_available():
        return jsonify({"error": "ffmpeg isn't installed (or not on PATH) — it's required to convert audio formats."}), 400

    converted, skipped, failed = 0, 0, []
    for f in list(os.listdir(DOWNLOAD_DIR)):
        full = os.path.join(DOWNLOAD_DIR, f)
        if not os.path.isfile(full) or f.endswith('.json') or f.startswith('.'):
            continue
        current_ext = os.path.splitext(f)[1].lstrip('.').lower()
        if current_ext == AUDIO_FORMAT:
            skipped += 1
            continue
        video_id, meta = find_meta_by_filename(f)
        try:
            new_path = convert_audio_file(full, AUDIO_FORMAT)
            new_filename = os.path.basename(new_path)
            if video_id and meta:
                meta['filename'] = new_filename
                save_meta(video_id, meta)
            converted += 1
        except Exception as e:
            failed.append({"file": f, "error": str(e)})

    return jsonify({"converted": converted, "skipped": skipped, "failed": failed})


# --- Feature 6/7: the download folder doubles as the "auto-import" playlist ---
@app.route('/api/library', methods=['GET'])
def library():
    files = []
    for f in sorted(os.listdir(DOWNLOAD_DIR)):
        full = os.path.join(DOWNLOAD_DIR, f)
        if not os.path.isfile(full) or f.endswith('.json') or f.startswith('.'):
            continue  # skips metadata/hidden files (temp/ is a sibling folder now, not nested here)
        video_id, meta = find_meta_by_filename(f)
        files.append({
            "videoId": video_id,
            "filename": f,
            "title": meta.get('title') or f,
            "audioUrl": f"{request.host_url.rstrip('/')}/downloads/{f}",
            "lyrics": meta.get('lyrics', ''),
            "source": meta.get('source', 'unknown'),
        })
    return jsonify({"files": files, "downloadDir": DOWNLOAD_DIR})


# --- Deletes a single downloaded song (its audio file + metadata json) ---
@app.route('/api/library/<video_id>', methods=['DELETE'])
def delete_library_item(video_id):
    meta = get_meta(video_id)
    filename = meta.get('filename')
    removed = False
    if filename:
        path = os.path.join(DOWNLOAD_DIR, filename)
        if os.path.exists(path):
            os.remove(path)
            removed = True
    meta_path = os.path.join(DOWNLOAD_DIR, f"{video_id}.json")
    if os.path.exists(meta_path):
        os.remove(meta_path)
    if not removed:
        return jsonify({"error": "No downloaded file found for that id."}), 404
    return jsonify({"ok": True})


# --- Settings: wipe every downloaded song + anything left in temp ---
@app.route('/api/library/clear', methods=['POST'])
def clear_library():
    removed_downloads = 0
    for f in os.listdir(DOWNLOAD_DIR):
        path = os.path.join(DOWNLOAD_DIR, f)
        if os.path.isfile(path):
            try:
                os.remove(path)
                removed_downloads += 1
            except Exception:
                pass

    removed_temp = 0
    for f in os.listdir(temp_dir()):
        path = os.path.join(temp_dir(), f)
        if os.path.isfile(path):
            try:
                os.remove(path)
                removed_temp += 1
            except Exception:
                pass
    _stream_titles.clear()

    return jsonify({"ok": True, "removedDownloads": removed_downloads, "removedTemp": removed_temp})


@app.route('/downloads/<path:filename>')
def serve_download(filename):
    return send_from_directory(DOWNLOAD_DIR, filename)


@app.route('/health')
def health():
    return jsonify({"status": "ok", "downloadDir": DOWNLOAD_DIR})


if __name__ == '__main__':
    app.run(port=5000, debug=True, threaded=True)