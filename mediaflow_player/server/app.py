import json
import os
import re

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from pytubefix import YouTube

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, expose_headers=["Content-Range", "Accept-Ranges", "Content-Length"])

DOWNLOAD_DIR = os.path.join(os.path.dirname(__file__), 'downloads')
os.makedirs(DOWNLOAD_DIR, exist_ok=True)


def is_valid_youtube_url(url):
    pattern = r"^(https?://)?(www\.)?(youtube\.com/watch\?v=|youtu\.be/)[\w-]+(&\S*)?$"
    return re.match(pattern, url) is not None


def extract_video_id(url):
    match = re.search(r"(?:v=|youtu\.be/)([\w-]{11})", url)
    return match.group(1) if match else None


def read_title(video_id):
    meta_path = os.path.join(DOWNLOAD_DIR, f"{video_id}.json")
    if os.path.exists(meta_path):
        try:
            with open(meta_path) as mf:
                return json.load(mf).get('title')
        except Exception:
            return None
    return None


def write_title(video_id, title):
    meta_path = os.path.join(DOWNLOAD_DIR, f"{video_id}.json")
    try:
        with open(meta_path, 'w') as mf:
            json.dump({"title": title}, mf)
    except Exception:
        pass


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

    # Reuse a file we've already downloaded for this video.
    for existing in os.listdir(DOWNLOAD_DIR):
        if existing.startswith(video_id + '.') and not existing.endswith('.json'):
            return jsonify({
                "audioUrl": f"{request.host_url.rstrip('/')}/downloads/{existing}",
                "title": read_title(video_id),
                "videoId": video_id,
            }), 200

    try:
        yt = YouTube(url)
        stream = yt.streams.get_audio_only()

        if not stream:
            return jsonify({"error": "No audio-only stream found for this video."}), 500

        filename = f"{video_id}.{stream.subtype}"
        stream.download(output_path=DOWNLOAD_DIR, filename=filename)
        write_title(video_id, yt.title)

        return jsonify({
            "audioUrl": f"{request.host_url.rstrip('/')}/downloads/{filename}",
            "title": yt.title,
            "videoId": video_id,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/library', methods=['GET'])
def library():
    files = []
    for f in sorted(os.listdir(DOWNLOAD_DIR)):
        if f.endswith('.json') or f.startswith('.'):
            continue
        video_id = f.rsplit('.', 1)[0]
        files.append({
            "videoId": video_id,
            "filename": f,
            "title": read_title(video_id) or video_id,
            "audioUrl": f"{request.host_url.rstrip('/')}/downloads/{f}",
        })
    return jsonify({"files": files})


@app.route('/downloads/<path:filename>')
def serve_download(filename):
    return send_from_directory(DOWNLOAD_DIR, filename)


@app.route('/health')
def health():
    return jsonify({"status": "ok"})


if __name__ == '__main__':
    app.run(port=5000, debug=True)