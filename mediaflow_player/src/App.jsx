/**
 * MediaFlow Player — A minimalist multimedia player in a single file.
 * Supports audio/video playback, visualizer, playlists, pitch/speed control,
 * cats easter egg, and keyboard shortcuts. No external UI libraries.
 */
import React, { useState, useRef, useEffect } from 'react';

/* ===== Constants ===== */
const STORAGE_KEY = 'mediaflow_data';
const CAT_EMOJIS = ['🐱', '🐈', '😺', '😸', '😻', '🐾', '😽', '🙀', '😹', '😼'];
const SPEED_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const ACCEPT = 'audio/*,video/*,.mkv,.avi,.flv,.wmv,.flac,.ogg,.opus,.aac,.m4a,.aiff,.wma,.alac,.mid,.midi';
const VIZ_OPTIONS = [
    { key: 'bars', label: 'Bars' },
    { key: 'circular', label: 'Circular' },
    { key: 'waveform', label: 'Wave' },
    { key: 'particles', label: 'Particles' },
    { key: 'orb', label: 'Orb' },
];
const API_BASE = import.meta.env?.VITE_API_URL || 'http://localhost:3001';

/* ===== Helpers ===== */
const formatTime = s => (!s || !isFinite(s)) ? '0:00' : `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const loadData = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { playlists: [] }; } catch { return { playlists: [] }; } };
const saveData = d => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch { } };

/* ===== Feature 7: tiny IndexedDB wrapper so imported ("outside") song
   files/blobs survive a page reload — browsers never expose a real
   filesystem path to JS, so storing the file's own bytes + metadata is
   the closest equivalent to "remembering where it lives". ===== */
const IDB_NAME = 'mediaflow_files';
const IDB_STORE = 'outside_files';
function idbOpen() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}
async function idbSaveFile(id, file, meta) {
    try {
        const db = await idbOpen();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readwrite');
            tx.objectStore(IDB_STORE).put({ file, meta }, id);
            tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
        });
    } catch (e) { console.warn('Could not persist imported file:', e); }
}
async function idbGetFile(id) {
    try {
        const db = await idbOpen();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readonly');
            const r = tx.objectStore(IDB_STORE).get(id);
            r.onsuccess = () => resolve(r.result || null);
            r.onerror = () => reject(r.error);
        });
    } catch { return null; }
}
async function idbDeleteFile(id) {
    try {
        const db = await idbOpen();
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(id);
    } catch { /* ignore */ }
}

/* ===== Inline SVG Icons (no icon library) ===== */
const ICONS = {
    play: () => <polygon points="6 4 20 12 6 20" fill="currentColor" stroke="none" />,
    pause: () => <><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" /></>,
    stop: () => <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />,
    next: () => <><polygon points="5 4 15 12 5 20" fill="currentColor" stroke="none" /><rect x="17" y="4" width="2.5" height="16" rx="1" fill="currentColor" stroke="none" /></>,
    prev: () => <><polygon points="19 4 9 12 19 20" fill="currentColor" stroke="none" /><rect x="4.5" y="4" width="2.5" height="16" rx="1" fill="currentColor" stroke="none" /></>,
    forward: () => <><polygon points="4 4 12 12 4 20" fill="currentColor" stroke="none" /><polygon points="12 4 20 12 12 20" fill="currentColor" stroke="none" /></>,
    rewind: () => <><polygon points="20 4 12 12 20 20" fill="currentColor" stroke="none" /><polygon points="12 4 4 12 12 20" fill="currentColor" stroke="none" /></>,
    shuffle: () => <><path d="M16 3h5v5" /><path d="M4 20L21 3" /><path d="M21 16v5h-5" /><path d="M15 15l6 6" /><path d="M4 4l5 5" /></>,
    repeat: () => <><path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" /></>,
    repeatOne: () => <><path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" /><text x="12" y="15.5" fontSize="7" fill="currentColor" stroke="none" textAnchor="middle" fontWeight="bold">1</text></>,
    volume: () => <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" /><path d="M15.5 8.5a5 5 0 010 7" /><path d="M18.5 5.5a10 10 0 010 13" /></>,
    volumeMute: () => <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" /><line x1="22" y1="9" x2="16" y2="15" /><line x1="16" y1="9" x2="22" y2="15" /></>,
    settings: () => <><circle cx="12" cy="12" r="3" /><path d="M12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
    list: () => <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></>,
    plus: () => <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
    trash: () => <><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></>,
    music: () => <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
    film: () => <><rect x="2" y="2" width="20" height="20" rx="2" /><line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" /><line x1="2" y1="12" x2="22" y2="12" /></>,
    sun: () => <><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" /><line x1="12" y1="2" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22" /><line x1="4.2" y1="4.2" x2="5.6" y2="5.6" /><line x1="18.4" y1="18.4" x2="19.8" y2="19.8" /><line x1="2" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22" y2="12" /><line x1="4.2" y1="19.8" x2="5.6" y2="18.4" /><line x1="18.4" y1="5.6" x2="19.8" y2="4.2" /></>,
    moon: () => <path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z" fill="currentColor" stroke="none" />,
    close: () => <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
    edit: () => <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></>,
    check: () => <polyline points="20 6 9 17 4 12" />,
    download: () => <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
    upload: () => <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
    drag: () => <><circle cx="9" cy="6" r="1.3" fill="currentColor" stroke="none" /><circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="9" cy="18" r="1.3" fill="currentColor" stroke="none" /><circle cx="15" cy="6" r="1.3" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="15" cy="18" r="1.3" fill="currentColor" stroke="none" /></>,
    gauge: () => <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
    folder: () => <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />,
    eye: () => <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
    eyeOff: () => <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>,
    search: () => <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
    spinner: () => <><path d="M12 2v4" /><path d="M12 18v4" /><path d="M4.93 4.93l2.83 2.83" /><path d="M16.24 16.24l2.83 2.83" /><path d="M2 12h4" /><path d="M18 12h4" /><path d="M4.93 19.07l2.83-2.83" /><path d="M16.24 7.76l2.83-2.83" /></>,
    wifi: () => <><path d="M5 12.55a11 11 0 0114.08 0" /><path d="M1.42 9a16 16 0 0121.16 0" /><path d="M8.53 16.11a6 6 0 016.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" /></>,
    mic: () => <><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><path d="M19 10v2a7 7 0 01-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></>,
    radio: () => <><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" /><path d="M4.93 19.07a10 10 0 010-14.14" /><path d="M7.76 16.24a6 6 0 010-8.48" /><path d="M16.24 7.76a6 6 0 010 8.48" /><path d="M19.07 4.93a10 10 0 010 14.14" /></>,
    disc: () => <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /></>,
    chevronRight: () => <polyline points="9 18 15 12 9 6" />,
};

function Icon({ name, size = 18, style }) {
    const I = ICONS[name];
    if (!I) return null;
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} {...(name === 'spinner' ? { 'data-spin': true } : {})}>
            <I />
        </svg>
    );
}

/* ===== Visualizer (canvas + Web Audio Analyser) ===== */
function Visualizer({ analyserRef, style, theme, simulated }) {
    const canvasRef = useRef(null);
    const particlesRef = useRef([]);
    const animRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const startTime = performance.now();

        // Streamed tracks (YouTube's CDN, no CORS headers) can never be routed
        // through the Web Audio graph without the browser silencing them — so
        // there's no real FFT data available for those. Rather than a dead
        // blank canvas, fake a lively, music-ish signal from layered sine
        // waves so the visualizer still feels alive while streaming.
        function fakeFrequencyData(bufLen, t) {
            const out = new Uint8Array(bufLen);
            for (let i = 0; i < bufLen; i++) {
                const f = i / bufLen;
                const v =
                    0.5 + 0.25 * Math.sin(t * 1.7 + f * 12) +
                    0.15 * Math.sin(t * 3.1 + f * 30) +
                    0.1 * Math.sin(t * 0.6 + f * 4);
                out[i] = Math.max(0, Math.min(255, Math.round(v * 255 * (1 - f * 0.3))));
            }
            return out;
        }
        function fakeTimeDomainData(bufLen, t) {
            const out = new Uint8Array(bufLen);
            for (let i = 0; i < bufLen; i++) {
                const v = Math.sin(i / bufLen * Math.PI * 6 + t * 2.2) * 0.3 + Math.sin(t * 0.8) * 0.05;
                out[i] = Math.max(0, Math.min(255, Math.round(128 + v * 128)));
            }
            return out;
        }

        const draw = () => {
            animRef.current = requestAnimationFrame(draw);
            const dpr = window.devicePixelRatio || 1;
            const w = canvas.offsetWidth;
            const h = canvas.offsetHeight;
            if (w === 0 || h === 0) return;
            if (canvas.width !== w * dpr) canvas.width = w * dpr;
            if (canvas.height !== h * dpr) canvas.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, w, h);

            const analyser = analyserRef.current;
            if (!simulated && !analyser) return;

            const bufLen = simulated ? 512 : analyser.frequencyBinCount;
            const data = new Uint8Array(bufLen);
            const rgb = theme === 'dark' ? '129, 140, 248' : '99, 102, 241';
            const t = (performance.now() - startTime) / 1000;

            // Small shim so the existing style code below can call these as if
            // they were the real AnalyserNode methods, whether we're simulating
            // or not.
            const getByteFrequencyData = target => {
                if (simulated) target.set(fakeFrequencyData(bufLen, t));
                else analyser.getByteFrequencyData(target);
            };
            const getByteTimeDomainData = target => {
                if (simulated) target.set(fakeTimeDomainData(bufLen, t));
                else analyser.getByteTimeDomainData(target);
            };

            if (style === 'bars') {
                getByteFrequencyData(data);
                const bars = 64;
                const bw = w / bars - 2;
                for (let i = 0; i < bars; i++) {
                    const v = data[Math.floor(i * bufLen / bars)] / 255;
                    const bh = v * h * 0.85;
                    const x = i * (bw + 2);
                    const g = ctx.createLinearGradient(0, h, 0, h - bh);
                    g.addColorStop(0, `rgba(${rgb}, 0.3)`);
                    g.addColorStop(1, `rgba(${rgb}, 0.9)`);
                    ctx.fillStyle = g;
                    ctx.fillRect(x, h - bh, bw, bh);
                }
            } else if (style === 'circular') {
                getByteFrequencyData(data);
                const cx = w / 2, cy = h / 2;
                const radius = Math.min(cx, cy) * 0.4;
                const bars = 128;
                for (let i = 0; i < bars; i++) {
                    const v = data[Math.floor(i * bufLen / bars)] / 255;
                    const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
                    const bh = v * radius * 1.2;
                    const x1 = cx + Math.cos(angle) * radius;
                    const y1 = cy + Math.sin(angle) * radius;
                    const x2 = cx + Math.cos(angle) * (radius + bh);
                    const y2 = cy + Math.sin(angle) * (radius + bh);
                    ctx.strokeStyle = `rgba(${rgb}, ${0.4 + v * 0.6})`;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                }
                ctx.beginPath();
                ctx.arc(cx, cy, radius * 0.3, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${rgb}, 0.15)`;
                ctx.fill();
            } else if (style === 'waveform') {
                getByteTimeDomainData(data);
                ctx.lineWidth = 2;
                ctx.strokeStyle = `rgb(${rgb})`;
                ctx.shadowColor = `rgb(${rgb})`;
                ctx.shadowBlur = 10;
                ctx.beginPath();
                const sw = w / bufLen;
                let x = 0;
                for (let i = 0; i < bufLen; i++) {
                    const v = data[i] / 128.0;
                    const y = (v * h) / 2;
                    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                    x += sw;
                }
                ctx.lineTo(w, h / 2);
                ctx.stroke();
                ctx.shadowBlur = 0;
            } else if (style === 'particles') {
                getByteFrequencyData(data);
                const avg = data.reduce((a, b) => a + b, 0) / data.length;
                const intensity = avg / 255;
                if (intensity > 0.1 && particlesRef.current.length < 200) {
                    for (let i = 0; i < Math.floor(intensity * 5); i++) {
                        particlesRef.current.push({
                            x: w / 2 + (Math.random() - 0.5) * 40,
                            y: h / 2 + (Math.random() - 0.5) * 40,
                            vx: (Math.random() - 0.5) * intensity * 6,
                            vy: (Math.random() - 0.5) * intensity * 6,
                            life: 1,
                            size: 1 + Math.random() * 3,
                        });
                    }
                }
                particlesRef.current = particlesRef.current.filter(p => {
                    p.x += p.vx; p.y += p.vy; p.life -= 0.015;
                    p.vx *= 0.99; p.vy *= 0.99;
                    if (p.life <= 0) return false;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(${rgb}, ${p.life * 0.8})`;
                    ctx.fill();
                    return true;
                });
            } else if (style === 'orb') {
                getByteFrequencyData(data);
                const cx = w / 2, cy = h / 2;
                const baseR = Math.min(w, h) * 0.22;
                const points = 96;
                const third = Math.floor(bufLen / 3);
                const bass = data.slice(0, third).reduce((a, b) => a + b, 0) / third / 255;
                const overall = data.reduce((a, b) => a + b, 0) / data.length / 255;

                ctx.save();
                ctx.shadowColor = `rgba(${rgb}, 0.8)`;
                ctx.shadowBlur = 30 + bass * 40;

                ctx.beginPath();
                for (let i = 0; i <= points; i++) {
                    const angle = (i / points) * Math.PI * 2;
                    const bin = Math.floor((i / points) * bufLen);
                    const v = data[bin] / 255;
                    const r = baseR * (1 + v * 0.9 + bass * 0.3);
                    const x = cx + Math.cos(angle) * r;
                    const y = cy + Math.sin(angle) * r;
                    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
                ctx.closePath();
                const grad = ctx.createRadialGradient(cx, cy, baseR * 0.2, cx, cy, baseR * (1.6 + overall));
                grad.addColorStop(0, `rgba(${rgb}, ${0.55 + overall * 0.35})`);
                grad.addColorStop(1, `rgba(${rgb}, 0.05)`);
                ctx.fillStyle = grad;
                ctx.fill();
                ctx.strokeStyle = `rgba(${rgb}, 0.9)`;
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.restore();

                ctx.beginPath();
                ctx.arc(cx, cy, baseR * 0.25, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${rgb}, ${0.5 + overall * 0.4})`;
                ctx.fill();
            }
        };

        draw();
        return () => cancelAnimationFrame(animRef.current);
    }, [style, theme, analyserRef, simulated]);

    return <canvas ref={canvasRef} className="mf-visualizer" />;
}

/* ===== Album / Artist track browser (shared between the two) ===== */
function AlbumOrArtistDetail({ item, kind, tracks, onBack, onDownloadAll, bulkDownloading, bulkProgress, downloadingId, downloadedIds, streamingId, currentTrack, onPlay, onDownload }) {
    const title = kind === 'album' ? item.title : item.name;
    const subtitle = kind === 'album' ? `${item.artist}${item.year ? ` · ${item.year}` : ''}` : `${tracks?.length || 0} songs`;
    return (
        <div className="mf-detail-view">
            <button className="mf-btn mf-back-btn" onClick={onBack}><Icon name="chevronRight" size={13} style={{ transform: 'rotate(180deg)' }} /> Back</button>
            <div className="mf-detail-header">
                {item.thumbnail ? (
                    <img className={`mf-detail-thumb ${kind === 'artist' ? 'mf-detail-thumb--round' : ''}`} src={item.thumbnail} alt="" />
                ) : (
                    <div className={`mf-detail-thumb mf-search-thumb--placeholder ${kind === 'artist' ? 'mf-detail-thumb--round' : ''}`}><Icon name={kind === 'album' ? 'disc' : 'mic'} size={24} /></div>
                )}
                <div className="mf-detail-meta">
                    <span className="mf-detail-title">{title}</span>
                    <span className="mf-search-sub">{subtitle}</span>
                </div>
            </div>
            <button className="mf-btn mf-btn-primary mf-download-all-btn" onClick={onDownloadAll} disabled={bulkDownloading || !tracks?.length}>
                <Icon name={bulkDownloading ? 'spinner' : 'download'} size={14} />
                {bulkDownloading ? `Downloading ${bulkProgress?.done || 0}/${bulkProgress?.total || 0}…` : `Download ${kind === 'album' ? 'Album' : 'All Shown'} (${tracks?.length || 0})`}
            </button>
            {!tracks?.length ? (
                <div className="mf-empty-state"><Icon name="music" size={32} /><p>No tracks found</p></div>
            ) : (
                tracks.map(t => {
                    const isDownloading = downloadingId === t.id;
                    const isDownloaded = downloadedIds.includes(t.id);
                    const isStreaming = streamingId === t.id;
                    const isPlayingThis = currentTrack?.videoId === t.id && currentTrack?.streamed;
                    return (
                        <div key={t.id} className="mf-search-result">
                            <div className="mf-search-meta">
                                <span className="mf-truncate mf-search-title">{t.title}</span>
                                <span className="mf-search-sub mf-truncate">{t.channel}{t.duration ? ` · ${t.duration}` : ''}</span>
                            </div>
                            <button className={`mf-btn-icon ${isPlayingThis ? 'mf-btn--accent' : ''}`} onClick={() => onPlay(t)} disabled={isStreaming} title={isPlayingThis ? 'Playing' : 'Play without downloading'}>
                                <Icon name={isStreaming ? 'spinner' : isPlayingThis ? 'pause' : 'play'} size={16} />
                            </button>
                            <button className={`mf-btn-icon mf-search-dl ${isDownloaded ? 'mf-search-dl--done' : ''}`} onClick={() => onDownload(t)} disabled={isDownloading || isDownloaded} title={isDownloaded ? 'Added to Auto Import' : 'Download & keep'}>
                                <Icon name={isDownloading ? 'spinner' : isDownloaded ? 'check' : 'download'} size={16} />
                            </button>
                        </div>
                    );
                })
            )}
        </div>
    );
}

/* ===== Cats Easter Egg ===== */
function CatsOverlay({ active }) {
    const [cats, setCats] = useState([]);

    useEffect(() => {
        if (!active) { setCats([]); return; }
        const spawn = () => {
            const id = uid();
            const cat = { id, emoji: CAT_EMOJIS[Math.floor(Math.random() * CAT_EMOJIS.length)], x: 5 + Math.random() * 85, y: 5 + Math.random() * 85, size: 20 + Math.random() * 24 };
            setCats(prev => [...prev.slice(-6), cat]);
            setTimeout(() => setCats(prev => prev.filter(c => c.id !== id)), 3000 + Math.random() * 2000);
        };
        const interval = setInterval(spawn, 4000 + Math.random() * 4000);
        spawn();
        return () => clearInterval(interval);
    }, [active]);

    if (!active) return null;
    return (
        <div className="mf-cats-overlay">
            {cats.map(cat => (
                <span key={cat.id} className="mf-cat" style={{ left: `${cat.x}%`, top: `${cat.y}%`, fontSize: `${cat.size}px` }}>{cat.emoji}</span>
            ))}
        </div>
    );
}

/* ===== Toggle Switch ===== */
function Toggle({ on, onClick }) {
    return (
        <button className={`mf-toggle ${on ? 'mf-toggle--on' : ''}`} onClick={onClick}>
            <span className="mf-toggle-knob" />
        </button>
    );
}

/* ===== Main Component ===== */
export default function Home() {
    // --- State ---
    const [currentTrack, setCurrentTrack] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [pitch, setPitch] = useState(1);
    const [loopMode, setLoopMode] = useState('none');
    const [shuffle, setShuffle] = useState(false);
    const [audioOnly, setAudioOnly] = useState(false);
    const [playlist, setPlaylist] = useState([]);
    const [playlists, setPlaylists] = useState([]);
    const [activePlaylistId, setActivePlaylistId] = useState(null);
    const [theme, setTheme] = useState(localStorage.getItem('player-theme') || 'dark');
    const [visualizerStyle, setVisualizerStyle] = useState('bars');
    const [catsMode, setCatsMode] = useState(localStorage.getItem('cats-mode') === 'true');
    const [sidePanel, setSidePanel] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [openPanel, setOpenPanel] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchMode, setSearchMode] = useState('songs'); // 'songs' | 'albums' | 'artists'
    const [searchResults, setSearchResults] = useState([]);
    const [albumResults, setAlbumResults] = useState([]);
    const [artistResults, setArtistResults] = useState([]);
    const [openAlbum, setOpenAlbum] = useState(null); // { id, title, artist, thumbnail, tracks }
    const [openArtist, setOpenArtist] = useState(null); // { id, name, thumbnail, songs }
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [bulkDownloading, setBulkDownloading] = useState(false);
    const [bulkProgress, setBulkProgress] = useState(null); // { done, total }
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState(null);
    const [downloadingId, setDownloadingId] = useState(null);
    const [downloadedIds, setDownloadedIds] = useState([]);
    const [streamingId, setStreamingId] = useState(null); // Feature 4/8

    // Feature 3: custom download location
    const [downloadDir, setDownloadDir] = useState('');
    const [downloadDirDraft, setDownloadDirDraft] = useState('');
    const [savingDir, setSavingDir] = useState(false);
    const [dirStatus, setDirStatus] = useState(null);
    const [clearingDownloads, setClearingDownloads] = useState(false);

    // Feature 2: manual lyrics for the current track
    const [lyricsDraft, setLyricsDraft] = useState('');
    const [lyricsSaved, setLyricsSaved] = useState(false);
    const [lyricsLoading, setLyricsLoading] = useState(false);

    // Feature 6: the auto-import library, presented as its own always-on playlist
    const AUTO_PLAYLIST_ID = 'auto-import';
    const [autoTracks, setAutoTracks] = useState([]);

    // Feature 8: similar-songs autoplay for streamed tracks
    const [autoplaySimilar, setAutoplaySimilar] = useState(localStorage.getItem('autoplay-similar') === 'true');
    const [relatedQueue, setRelatedQueue] = useState([]);
    const [findingRelated, setFindingRelated] = useState(false);

    // --- Refs ---
    const mediaRef = useRef(null);
    const streamRef = useRef(null);
    const audioCtxRef = useRef(null);
    const analyserRef = useRef(null);
    const gainRef = useRef(null);
    const fileInputRef = useRef(null);
    const importInputRef = useRef(null);
    const dragIndexRef = useRef(null);
    const prevVolumeRef = useRef(1);
    const keyHandlerRef = useRef(() => { });
    const activePlaylistIdRef = useRef(null);
    const autoplayHistoryRef = useRef(new Set());

    // Streamed tracks play on a separate <audio> element that's never wired
    // into the Web Audio graph, so cross-origin CDN audio (no CORS headers)
    // isn't silenced by the browser.
    function activeEl() { return currentTrack?.streamed ? streamRef.current : mediaRef.current; }

    // --- Initialize Web Audio API (called on first user interaction) ---
    function initAudio() {
        if (audioCtxRef.current || !mediaRef.current) return;
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 1024;
            analyser.smoothingTimeConstant = 0.8;
            const gain = ctx.createGain();
            gain.gain.value = isMuted ? 0 : volume;
            const src = ctx.createMediaElementSource(mediaRef.current);
            src.connect(gain);
            gain.connect(analyser);
            analyser.connect(ctx.destination);
            audioCtxRef.current = ctx;
            analyserRef.current = analyser;
            gainRef.current = gain;
            mediaRef.current.volume = 1; // Gain node handles volume now
        } catch (e) { console.warn('Audio init failed:', e); }
    }

    // --- Apply pitch & speed to whichever element is active ---
    useEffect(() => {
        [mediaRef.current, streamRef.current].forEach(el => {
            if (!el) return;
            const setPP = v => {
                if ('preservesPitch' in el) el.preservesPitch = v;
                if ('mozPreservesPitch' in el) el.mozPreservesPitch = v;
                if ('webkitPreservesPitch' in el) el.webkitPreservesPitch = v;
            };
            if (pitch === 1) { el.playbackRate = playbackRate; setPP(true); }
            else { el.playbackRate = playbackRate * pitch; setPP(false); }
        });
    }, [playbackRate, pitch]);

    // --- Theme ---
    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('player-theme', theme);
    }, [theme]);

    // --- Load saved playlists on mount ---
    useEffect(() => { setPlaylists(loadData().playlists || []); }, []);

    useEffect(() => { activePlaylistIdRef.current = activePlaylistId; }, [activePlaylistId]);

    // --- Save playlists when changed ---
    useEffect(() => { saveData({ playlists }); }, [playlists]);

    // --- Update keyboard handler ref (always has latest state) ---
    keyHandlerRef.current = e => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        switch (e.key) {
            case ' ': e.preventDefault(); if (currentIndex >= 0 || currentTrack) togglePlay(); break;
            case 'ArrowRight': e.preventDefault(); skip(e.shiftKey ? 30 : 10); break;
            case 'ArrowLeft': e.preventDefault(); skip(e.shiftKey ? -30 : -10); break;
            case 'ArrowUp': e.preventDefault(); changeVolume(Math.min(2, volume + 0.05)); break;
            case 'ArrowDown': e.preventDefault(); changeVolume(Math.max(0, volume - 0.05)); break;
            case 'm': case 'M': toggleMute(); break;
            case 'n': case 'N': playNext(); break;
            case 'p': case 'P': playPrev(); break;
        }
    };

    // --- Register keyboard listener once ---
    useEffect(() => {
        const h = e => keyHandlerRef.current(e);
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, []);

    /* --- Playback --- */
    function togglePlay() {
        const el = activeEl();
        if (!el || !currentTrack) return;
        if (!currentTrack.streamed) {
            initAudio();
            if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
        }
        if (isPlaying) el.pause(); else el.play().catch(() => { });
    }

    function stop() {
        const el = activeEl();
        if (!el) return;
        el.pause(); el.currentTime = 0;
        setIsPlaying(false); setCurrentTime(0);
    }

    function seek(t) {
        const el = activeEl();
        if (!el) return;
        el.currentTime = t; setCurrentTime(t);
    }

    function skip(sec) {
        const el = activeEl();
        if (!el) return;
        el.currentTime = Math.max(0, Math.min(el.currentTime + sec, el.duration || 0));
    }

    function changeVolume(vol) {
        setVolume(vol); setIsMuted(vol === 0); prevVolumeRef.current = vol;
        if (currentTrack?.streamed) { if (streamRef.current) streamRef.current.volume = Math.min(vol, 1); return; }
        if (gainRef.current) gainRef.current.gain.value = vol;
        else if (mediaRef.current) mediaRef.current.volume = Math.min(vol, 1);
    }

    function toggleMute() {
        if (isMuted) { changeVolume(prevVolumeRef.current || 1); setIsMuted(false); }
        else {
            prevVolumeRef.current = volume; setIsMuted(true);
            if (currentTrack?.streamed) { if (streamRef.current) streamRef.current.volume = 0; }
            else if (gainRef.current) gainRef.current.gain.value = 0;
            else if (mediaRef.current) mediaRef.current.volume = 0;
        }
    }

    function playTrackAt(index, list) {
        const track = list[index];
        if (!track || !track.url) return;
        // Switching from a stream back to a downloaded/local track — stop the
        // stream element and clean up its temp file server-side.
        if (streamRef.current) { streamRef.current.pause(); streamRef.current.src = ''; }
        if (currentTrack?.streamed && currentTrack.videoId) endStream(currentTrack.videoId);
        initAudio();
        if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
        const el = mediaRef.current;
        if (el) { el.src = track.url; el.load(); el.play().catch(() => { }); }
        setCurrentTrack(track); setCurrentIndex(index);
        setIsPlaying(true); setCurrentTime(0); setDuration(0);
    }

    function playTrack(index) { playTrackAt(index, playlist); }

    function playNext() {
        if (playlist.length === 0) return;
        let next;
        if (shuffle) next = Math.floor(Math.random() * playlist.length);
        else {
            next = currentIndex + 1;
            if (next >= playlist.length) { if (loopMode === 'all') next = 0; else { stop(); return; } }
        }
        playTrack(next);
    }

    function playPrev() {
        if (playlist.length === 0) return;
        const el = activeEl();
        if (el && el.currentTime > 3) { el.currentTime = 0; return; }
        let prev;
        if (shuffle) prev = Math.floor(Math.random() * playlist.length);
        else {
            prev = currentIndex - 1;
            if (prev < 0) prev = loopMode === 'all' ? playlist.length - 1 : 0;
        }
        playTrack(prev);
    }

    // Feature 4: temp files for streamed (not "kept") tracks live server-side
    // under downloads/temp and should be cleaned up as soon as that song's
    // stream is over — best-effort, failures here shouldn't bother the user.
    function endStream(videoId) {
        if (!videoId) return;
        fetch(`${API_BASE}/api/stream/${encodeURIComponent(videoId)}`, { method: 'DELETE' }).catch(() => { });
    }

    function handleEnded() {
        if (loopMode === 'one') { seek(0); activeEl()?.play().catch(() => { }); }
        else if (currentTrack?.streamed && autoplaySimilar && relatedQueue.length) {
            if (currentTrack.videoId) endStream(currentTrack.videoId);
            // Defensive re-check: skip anything already played in this chain
            // in case the queue was fetched before it was added to history.
            const rest = [...relatedQueue];
            let next = rest.shift();
            while (next && autoplayHistoryRef.current.has(next.id) && rest.length) next = rest.shift();
            setRelatedQueue(rest);
            if (next && !autoplayHistoryRef.current.has(next.id)) playStreamed(next, { fromQueue: true });
            else playNext();
        }
        else {
            if (currentTrack?.streamed && currentTrack.videoId) endStream(currentTrack.videoId);
            playNext();
        }
    }

    // Feature 4: best-effort cleanup if the app is closed while a stream is playing.
    useEffect(() => {
        function onUnload() {
            if (currentTrack?.streamed && currentTrack.videoId) {
                fetch(`${API_BASE}/api/stream/${encodeURIComponent(currentTrack.videoId)}`, { method: 'DELETE', keepalive: true }).catch(() => { });
            }
        }
        window.addEventListener('beforeunload', onUnload);
        return () => window.removeEventListener('beforeunload', onUnload);
    }, [currentTrack]);

    // Feature 2: keep the lyrics editor in sync with whatever's playing.
    useEffect(() => { loadLyricsFor(currentTrack); }, [currentTrack?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { localStorage.setItem('autoplay-similar', String(autoplaySimilar)); }, [autoplaySimilar]);

    /* --- File & Playlist Management --- */
    function handleAddFiles(e) {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        const newTracks = files.map(f => ({
            id: uid(),
            name: f.name.replace(/\.[^/.]+$/, ''),
            type: f.type || (/\.(mp4|mkv|avi|mov|webm|wmv|flv|mpeg)$/i.test(f.name) ? 'video' : 'audio'),
            url: URL.createObjectURL(f),
            source: 'local',
        }));
        // Feature 7: remember these "outside" songs (their bytes + name) so the
        // playlist can restore them next time the page loads.
        newTracks.forEach((t, i) => idbSaveFile(t.id, files[i], { name: t.name, type: t.type }));
        const updated = [...playlist, ...newTracks];
        setPlaylist(updated);
        if (activePlaylistId && activePlaylistId !== AUTO_PLAYLIST_ID) updatePlaylistData(activePlaylistId, { tracks: updated });
        if (currentIndex === -1) playTrackAt(playlist.length, updated);
        e.target.value = '';
    }

    // Feature 7: when a saved playlist is loaded, any "local" tracks only have
    // a dead blob: URL (blob URLs don't survive reloads) — rehydrate them
    // from IndexedDB.
    async function rehydrateLocalTracks(tracks) {
        const needsHydration = tracks.some(t => t.source === 'local' && (!t.url || t.url.startsWith('blob:') === false));
        if (!needsHydration) return tracks;
        const results = await Promise.all(tracks.map(async t => {
            if (t.source !== 'local') return t;
            const rec = await idbGetFile(t.id);
            if (rec?.file) return { ...t, url: URL.createObjectURL(rec.file) };
            return t; // file no longer available locally
        }));
        return results;
    }

    function updatePlaylistData(id, data) {
        if (id === AUTO_PLAYLIST_ID) return; // auto-import is server-driven, not stored locally
        setPlaylists(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
    }

    function createPlaylist() {
        const pl = { id: uid(), name: 'New Playlist', tracks: [] };
        setPlaylists(prev => [...prev, pl]);
        loadPlaylist(pl);
    }

    function loadPlaylist(pl) {
        setPlaylist(pl.tracks || []);
        setActivePlaylistId(pl.id);
        setCurrentIndex(-1); setCurrentTrack(null); setIsPlaying(false);
        if (mediaRef.current) { mediaRef.current.pause(); mediaRef.current.src = ''; }
        rehydrateLocalTracks(pl.tracks || []).then(hydrated => {
            setPlaylist(hydrated);
            updatePlaylistData(pl.id, { tracks: hydrated });
        });
    }

    function deletePlaylist(id) {
        setPlaylists(prev => prev.filter(p => p.id !== id));
        if (activePlaylistId === id) {
            setPlaylist([]); setActivePlaylistId(null);
            setCurrentIndex(-1); setCurrentTrack(null); setIsPlaying(false);
            if (mediaRef.current) { mediaRef.current.pause(); mediaRef.current.src = ''; }
        }
    }

    function saveRename() {
        if (editingId) { updatePlaylistData(editingId, { name: editName }); setEditingId(null); }
    }

    function removeTrack(idx) {
        const removed = playlist[idx];
        if (removed?.source === 'local') idbDeleteFile(removed.id);
        const updated = playlist.filter((_, i) => i !== idx);
        let newIndex = currentIndex;
        if (idx < currentIndex) newIndex--;
        else if (idx === currentIndex) newIndex = -1;
        setPlaylist(updated); setCurrentIndex(newIndex);
        if (newIndex === -1) {
            setCurrentTrack(null); setIsPlaying(false);
            if (mediaRef.current) { mediaRef.current.pause(); mediaRef.current.src = ''; }
        }
        if (activePlaylistId && activePlaylistId !== AUTO_PLAYLIST_ID) updatePlaylistData(activePlaylistId, { tracks: updated });
    }

    // Deletes a downloaded song's actual file from disk (not just from the
    // current queue) — separate from removeTrack, which only unqueues it.
    async function deleteLibraryFile(track) {
        if (!track?.videoId) return;
        if (!window.confirm(`Delete "${track.name}" from disk? This can't be undone.`)) return;
        try {
            const res = await fetch(`${API_BASE}/api/library/${encodeURIComponent(track.videoId)}`, { method: 'DELETE' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Could not delete file');

            setAutoTracks(prev => prev.filter(t => t.videoId !== track.videoId));
            setPlaylist(prev => prev.filter(t => t.videoId !== track.videoId));
            if (currentTrack?.videoId === track.videoId) {
                if (mediaRef.current) { mediaRef.current.pause(); mediaRef.current.src = ''; }
                setCurrentTrack(null); setCurrentIndex(-1); setIsPlaying(false);
            }
        } catch (err) {
            console.warn('Delete file failed:', err);
            setSearchError(err.message || 'Could not delete file.');
        }
    }

    function handleReorder(from, to) {
        if (from === to || from === null) return;
        const items = Array.from(playlist);
        const [moved] = items.splice(from, 1);
        items.splice(to, 0, moved);
        let newIndex = currentIndex;
        if (currentIndex === from) newIndex = to;
        else if (from < currentIndex && to >= currentIndex) newIndex--;
        else if (from > currentIndex && to <= currentIndex) newIndex++;
        setPlaylist(items); setCurrentIndex(newIndex);
        if (activePlaylistId && activePlaylistId !== AUTO_PLAYLIST_ID) updatePlaylistData(activePlaylistId, { tracks: items });
    }

    function exportPlaylist() {
        const pl = playlists.find(p => p.id === activePlaylistId);
        const data = { name: pl?.name || 'Playlist', tracks: playlist.map(t => ({ name: t.name, type: t.type })) };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${data.name}.json`; a.click();
        URL.revokeObjectURL(url);
    }

    function importPlaylist(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        file.text().then(text => {
            const data = JSON.parse(text);
            const pl = { id: uid(), name: data.name || 'Imported Playlist', tracks: (data.tracks || []).map(t => ({ ...t, id: uid(), url: '' })) };
            setPlaylists(prev => [...prev, pl]);
            loadPlaylist(pl);
        });
        e.target.value = '';
    }

    /* --- Feature 6/7: auto-import is its own always-on playlist, built from
       whatever's in the server's download folder. Any new download (search
       result or "keep" from a stream) lands here automatically. --- */
    async function refreshAutoImport() {
        try {
            const res = await fetch(`${API_BASE}/api/library`);
            if (!res.ok) return;
            const data = await res.json();
            const files = data.files || [];
            if (data.downloadDir) { setDownloadDir(data.downloadDir); setDownloadDirDraft(prev => prev || data.downloadDir); }
            const tracks = files.map(f => ({
                id: f.videoId || uid(),
                videoId: f.videoId || null,
                name: f.title || f.videoId || f.filename,
                type: 'audio',
                url: f.audioUrl,
                lyrics: f.lyrics || '',
                source: 'youtube',
            }));
            setAutoTracks(tracks);
            // If the auto-import playlist is currently open, keep the live view in sync.
            if (activePlaylistIdRef.current === AUTO_PLAYLIST_ID) setPlaylist(tracks);
        } catch (err) {
            console.warn('Auto-import from library failed (is the Python server running?):', err);
        }
    }

    useEffect(() => { refreshAutoImport(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    function loadAutoPlaylist() {
        setPlaylist(autoTracks);
        setActivePlaylistId(AUTO_PLAYLIST_ID);
        setCurrentIndex(-1); setCurrentTrack(null); setIsPlaying(false);
        if (mediaRef.current) { mediaRef.current.pause(); mediaRef.current.src = ''; }
        refreshAutoImport();
    }

    /* --- Song / Album / Artist Search & Download --- */
    async function handleSearch(e) {
        e?.preventDefault();
        const q = searchQuery.trim();
        if (!q || isSearching) return;
        setIsSearching(true);
        setSearchError(null);
        setOpenAlbum(null); setOpenArtist(null);
        try {
            const endpoint = searchMode === 'albums' ? '/api/search/albums' : searchMode === 'artists' ? '/api/search/artists' : '/api/search';
            const res = await fetch(`${API_BASE}${endpoint}?q=${encodeURIComponent(q)}`);
            if (!res.ok) throw new Error('Search request failed');
            const data = await res.json();
            if (searchMode === 'albums') setAlbumResults(data.results || []);
            else if (searchMode === 'artists') setArtistResults(data.results || []);
            else setSearchResults(data.results || []);
        } catch (err) {
            console.warn('Search failed:', err);
            setSearchError('Could not search right now. Is the server running?');
            setSearchResults([]); setAlbumResults([]); setArtistResults([]);
        } finally {
            setIsSearching(false);
        }
    }

    async function openAlbumDetail(album) {
        setLoadingDetail(true);
        setSearchError(null);
        try {
            const res = await fetch(`${API_BASE}/api/album/${encodeURIComponent(album.id)}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not load album');
            setOpenAlbum({ ...data, thumbnail: data.thumbnail || album.thumbnail });
        } catch (err) {
            setSearchError(err.message || 'Could not load that album');
        } finally {
            setLoadingDetail(false);
        }
    }

    async function openArtistDetail(artist) {
        setLoadingDetail(true);
        setSearchError(null);
        try {
            const params = new URLSearchParams({ name: artist.name || '' });
            const res = await fetch(`${API_BASE}/api/artist/${encodeURIComponent(artist.id)}?${params}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not load artist');
            setOpenArtist({ ...data, thumbnail: data.thumbnail || artist.thumbnail });
            if (data.partial) setSearchError('Showing a best-effort song list — YouTube Music\'s full artist page for this one didn\'t parse cleanly.');
        } catch (err) {
            setSearchError(err.message || 'Could not load that artist');
        } finally {
            setLoadingDetail(false);
        }
    }

    // Downloads a whole album (or an artist's listed songs), one track at a
    // time so the server + this UI don't get hammered all at once.
    async function downloadAllTracks(tracks) {
        if (bulkDownloading || !tracks?.length) return;
        setBulkDownloading(true);
        setBulkProgress({ done: 0, total: tracks.length });
        for (let i = 0; i < tracks.length; i++) {
            const t = tracks[i];
            if (!downloadedIds.includes(t.id)) {
                await handleDownloadResult(t);
            }
            setBulkProgress({ done: i + 1, total: tracks.length });
        }
        setBulkDownloading(false);
        setBulkProgress(null);
    }

    // Feature 6: every download lands in the auto-import playlist (the download
    // folder is the source of truth); if the user is looking at some other
    // playlist right now we also drop it into their current queue so it plays.
    async function handleDownloadResult(result) {
        if (downloadingId) return;
        setDownloadingId(result.id);
        setSearchError(null);
        try {
            const res = await fetch(`${API_BASE}/api/download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: result.url }),
            });
            const data = await res.json();
            if (!res.ok || !data.audioUrl) throw new Error(data.error || 'Download failed');

            await refreshAutoImport();

            if (activePlaylistId && activePlaylistId !== AUTO_PLAYLIST_ID) {
                const track = { id: data.videoId || uid(), videoId: data.videoId || null, name: data.title || result.title, type: 'audio', url: data.audioUrl, source: 'youtube', lyrics: data.lyrics || '' };
                const updated = [...playlist, track];
                setPlaylist(updated);
                updatePlaylistData(activePlaylistId, { tracks: updated });
                if (currentIndex === -1) playTrackAt(playlist.length, updated);
            }
            setDownloadedIds(prev => [...prev, result.id]);
        } catch (err) {
            console.warn('Download failed:', err);
            setSearchError(err.message || 'Download failed. Please try again.');
        } finally {
            setDownloadingId(null);
        }
    }

    // --- Feature 4: play a search result straight from YouTube's CDN, no
    // download. Feature 8: also used to autoplay the related-songs queue. ---
    async function playStreamed(result, { fromQueue = false } = {}) {
        setStreamingId(result.id);
        setSearchError(null);
        // A different stream is starting — the one that was playing (if any) is done.
        if (currentTrack?.streamed && currentTrack.videoId) endStream(currentTrack.videoId);
        // A manually-picked track starts a fresh autoplay chain; a track pulled
        // from the up-next queue continues the existing one.
        if (!fromQueue) autoplayHistoryRef.current = new Set();
        try {
            const res = await fetch(`${API_BASE}/api/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: result.url }),
            });
            const data = await res.json();
            if (!res.ok || !data.audioUrl) throw new Error(data.error || 'Could not stream this track');

            const track = {
                id: data.videoId || uid(),
                videoId: data.videoId || null,
                name: data.title || result.title,
                channel: result.channel,
                sourceUrl: result.url,
                type: 'audio',
                url: data.audioUrl,
                streamed: true, // no local file → no id/json → lyrics can't be attached (Feature 4)
            };
            if (track.videoId) autoplayHistoryRef.current.add(track.videoId);
            // Pause any downloaded/local playback on the Web-Audio-connected element,
            // then play this one on the separate, CORS-free stream element.
            if (mediaRef.current) mediaRef.current.pause();
            const el = streamRef.current;
            if (el) { el.src = track.url; el.load(); el.play().catch(() => { }); }
            setCurrentTrack(track); setCurrentIndex(-1);
            setIsPlaying(true); setCurrentTime(0); setDuration(0);
            if (autoplaySimilar) fetchRelated(track);
            else setRelatedQueue([]);
        } catch (err) {
            console.warn('Stream failed:', err);
            setSearchError(err.message || 'Could not stream this track.');
        } finally {
            setStreamingId(null);
        }
    }

    // Feature 8: pull similar songs (YouTube Music's own "up next" queue for
    // this track) so playback can continue automatically past a streamed
    // (not-downloaded) track. Filters out anything already played in this
    // autoplay chain so the radio can't loop back to a song we just heard.
    async function fetchRelated(track) {
        setFindingRelated(true);
        try {
            const params = new URLSearchParams({ videoId: track.videoId || '', artist: track.channel || '', title: track.name || '' });
            const res = await fetch(`${API_BASE}/api/related?${params}`);
            const data = await res.json();
            const fresh = (data.results || []).filter(r => !autoplayHistoryRef.current.has(r.id));
            setRelatedQueue(fresh);
        } catch (err) {
            console.warn('Related lookup failed:', err);
            setRelatedQueue([]);
        } finally {
            setFindingRelated(false);
        }
    }

    // Feature 8: the "keep it" download button living next to play/pause for
    // whatever's currently streaming.
    async function keepCurrentStreamedTrack() {
        if (!currentTrack?.streamed || !currentTrack.sourceUrl) return;
        await handleDownloadResult({ id: currentTrack.videoId || currentTrack.id, url: currentTrack.sourceUrl, title: currentTrack.name });
    }

    // --- Feature 2: manual lyrics ---
    async function loadLyricsFor(track) {
        if (!track || track.streamed || !track.videoId) { setLyricsDraft(''); return; }
        setLyricsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/lyrics/${encodeURIComponent(track.videoId)}`);
            const data = await res.json();
            setLyricsDraft(data.lyrics || track.lyrics || '');
        } catch {
            setLyricsDraft(track.lyrics || '');
        } finally {
            setLyricsLoading(false);
        }
    }

    async function saveLyrics() {
        if (!currentTrack || currentTrack.streamed || !currentTrack.videoId) return;
        setLyricsSaved(false);
        try {
            const res = await fetch(`${API_BASE}/api/lyrics/${encodeURIComponent(currentTrack.videoId)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lyrics: lyricsDraft }),
            });
            if (!res.ok) throw new Error();
            setLyricsSaved(true);
            setTimeout(() => setLyricsSaved(false), 1500);
        } catch {
            setSearchError('Could not save lyrics right now.');
        }
    }

    // --- Feature 3: custom download location ---
    async function saveDownloadDir() {
        if (!downloadDirDraft.trim() || savingDir) return;
        setSavingDir(true);
        setDirStatus(null);
        try {
            const res = await fetch(`${API_BASE}/api/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ downloadDir: downloadDirDraft.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not update download location');
            setDownloadDir(data.downloadDir);
            setDirStatus({ ok: true, msg: `Saved. Moved ${data.movedFiles} existing file(s) to the new folder.` });
            refreshAutoImport();
        } catch (err) {
            setDirStatus({ ok: false, msg: err.message || 'Could not update download location' });
        } finally {
            setSavingDir(false);
        }
    }

    // --- Clears every downloaded song + anything left in downloads/temp ---
    async function clearAllDownloads() {
        if (clearingDownloads) return;
        if (!window.confirm('Delete ALL downloaded songs and temp files from disk? This can\'t be undone.')) return;
        setClearingDownloads(true);
        setDirStatus(null);
        try {
            const res = await fetch(`${API_BASE}/api/library/clear`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not clear downloads');
            setAutoTracks([]);
            if (isAutoPlaylistActive) setPlaylist([]);
            if (currentTrack?.videoId) {
                if (mediaRef.current) { mediaRef.current.pause(); mediaRef.current.src = ''; }
                if (streamRef.current) { streamRef.current.pause(); streamRef.current.src = ''; }
                setCurrentTrack(null); setCurrentIndex(-1); setIsPlaying(false);
            }
            setDirStatus({ ok: true, msg: `Cleared ${data.removedDownloads} download(s) and ${data.removedTemp} temp file(s).` });
        } catch (err) {
            setDirStatus({ ok: false, msg: err.message || 'Could not clear downloads' });
        } finally {
            setClearingDownloads(false);
        }
    }


    function cycleLoop() {
        const modes = ['none', 'all', 'one'];
        setLoopMode(modes[(modes.indexOf(loopMode) + 1) % 3]);
    }

    // --- Derived ---
    const isVideoFile = currentTrack?.type?.startsWith('video');
    const showVideo = isVideoFile && !audioOnly && currentTrack;
    const showVisualizer = currentTrack && (!isVideoFile || audioOnly);
    const activePL = activePlaylistId === AUTO_PLAYLIST_ID
        ? { id: AUTO_PLAYLIST_ID, name: 'Auto Import' }
        : playlists.find(p => p.id === activePlaylistId);
    const isAutoPlaylistActive = activePlaylistId === AUTO_PLAYLIST_ID;

    // --- Render ---
    return (
        <div className="mf-app">
            <CatsOverlay active={catsMode} />

            {/* Sidebar */}
            {sidePanel && (
                <>
                    <div className="mf-sidebar-backdrop" onClick={() => setSidePanel(null)} />
                    <div className="mf-sidebar">
                        <div className="mf-sidebar-header">
                            <button className={`mf-tab ${sidePanel === 'playlist' ? 'mf-tab--active' : ''}`} onClick={() => setSidePanel('playlist')}>
                                <Icon name="list" size={16} /> Playlist
                            </button>
                            <button className={`mf-tab ${sidePanel === 'search' ? 'mf-tab--active' : ''}`} onClick={() => setSidePanel('search')}>
                                <Icon name="search" size={16} /> Search
                            </button>
                            <button className={`mf-tab ${sidePanel === 'lyrics' ? 'mf-tab--active' : ''}`} onClick={() => setSidePanel('lyrics')}>
                                <Icon name="mic" size={16} /> Lyrics
                            </button>
                            <button className={`mf-tab ${sidePanel === 'settings' ? 'mf-tab--active' : ''}`} onClick={() => setSidePanel('settings')}>
                                <Icon name="settings" size={16} /> Settings
                            </button>
                            <button className="mf-btn-icon" style={{ marginLeft: 'auto' }} onClick={() => setSidePanel(null)}>
                                <Icon name="close" size={18} />
                            </button>
                        </div>

                        <div className="mf-sidebar-content">
                            {sidePanel === 'search' ? (
                                <div className="mf-search-panel">
                                    <div className="mf-search-mode-tabs">
                                        {[['songs', 'Songs'], ['albums', 'Albums'], ['artists', 'Artists']].map(([key, label]) => (
                                            <button
                                                key={key}
                                                className={`mf-search-mode-tab ${searchMode === key ? 'mf-search-mode-tab--active' : ''}`}
                                                onClick={() => { setSearchMode(key); setOpenAlbum(null); setOpenArtist(null); }}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>

                                    <form className="mf-search-form" onSubmit={handleSearch}>
                                        <div className="mf-search-input-wrap">
                                            <Icon name="search" size={15} />
                                            <input
                                                className="mf-search-input"
                                                placeholder={searchMode === 'albums' ? 'Search for an album...' : searchMode === 'artists' ? 'Search for an artist...' : 'Search for a song...'}
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                                autoFocus
                                            />
                                            {searchQuery && (
                                                <button type="button" className="mf-search-clear" onClick={() => { setSearchQuery(''); setSearchResults([]); setAlbumResults([]); setArtistResults([]); setSearchError(null); }}>
                                                    <Icon name="close" size={13} />
                                                </button>
                                            )}
                                        </div>
                                        <button type="submit" className="mf-btn-icon mf-search-go" disabled={isSearching || !searchQuery.trim()} title="Search">
                                            <Icon name={isSearching ? 'spinner' : 'search'} size={16} />
                                        </button>
                                    </form>

                                    {searchError && <p className="mf-search-error">{searchError}</p>}

                                    {searchMode === 'songs' && (
                                        <div className="mf-setting-row mf-autoplay-row">
                                            <div className="mf-setting-label">
                                                <Icon name="radio" size={15} />
                                                <span>Autoplay similar songs</span>
                                            </div>
                                            <Toggle on={autoplaySimilar} onClick={() => setAutoplaySimilar(!autoplaySimilar)} />
                                        </div>
                                    )}

                                    <div className="mf-track-list mf-search-results">
                                        {isSearching || loadingDetail ? (
                                            <div className="mf-empty-state">
                                                <Icon name="spinner" size={32} />
                                                <p>{loadingDetail ? 'Loading…' : 'Searching…'}</p>
                                            </div>
                                        ) : searchMode === 'albums' ? (
                                            openAlbum ? (
                                                <AlbumOrArtistDetail
                                                    item={openAlbum}
                                                    kind="album"
                                                    tracks={openAlbum.tracks}
                                                    onBack={() => setOpenAlbum(null)}
                                                    onDownloadAll={() => downloadAllTracks(openAlbum.tracks)}
                                                    bulkDownloading={bulkDownloading}
                                                    bulkProgress={bulkProgress}
                                                    downloadingId={downloadingId}
                                                    downloadedIds={downloadedIds}
                                                    streamingId={streamingId}
                                                    currentTrack={currentTrack}
                                                    onPlay={playStreamed}
                                                    onDownload={handleDownloadResult}
                                                />
                                            ) : albumResults.length === 0 ? (
                                                <div className="mf-empty-state">
                                                    <Icon name="disc" size={36} />
                                                    <p>{searchQuery ? 'No albums found' : 'Find an album'}</p>
                                                    <p className="mf-empty-hint">Search by album or artist name</p>
                                                </div>
                                            ) : (
                                                albumResults.map(a => (
                                                    <div key={a.id} className="mf-search-result mf-browse-card" onClick={() => openAlbumDetail(a)}>
                                                        {a.thumbnail ? <img className="mf-search-thumb" src={a.thumbnail} alt="" /> : <div className="mf-search-thumb mf-search-thumb--placeholder"><Icon name="disc" size={16} /></div>}
                                                        <div className="mf-search-meta">
                                                            <span className="mf-truncate mf-search-title">{a.title}</span>
                                                            <span className="mf-search-sub mf-truncate">{a.artist}{a.year ? ` · ${a.year}` : ''}</span>
                                                        </div>
                                                        <Icon name="chevronRight" size={16} />
                                                    </div>
                                                ))
                                            )
                                        ) : searchMode === 'artists' ? (
                                            openArtist ? (
                                                <AlbumOrArtistDetail
                                                    item={openArtist}
                                                    kind="artist"
                                                    tracks={openArtist.songs}
                                                    onBack={() => setOpenArtist(null)}
                                                    onDownloadAll={() => downloadAllTracks(openArtist.songs)}
                                                    bulkDownloading={bulkDownloading}
                                                    bulkProgress={bulkProgress}
                                                    downloadingId={downloadingId}
                                                    downloadedIds={downloadedIds}
                                                    streamingId={streamingId}
                                                    currentTrack={currentTrack}
                                                    onPlay={playStreamed}
                                                    onDownload={handleDownloadResult}
                                                />
                                            ) : artistResults.length === 0 ? (
                                                <div className="mf-empty-state">
                                                    <Icon name="mic" size={36} />
                                                    <p>{searchQuery ? 'No artists found' : 'Find an artist'}</p>
                                                    <p className="mf-empty-hint">Browse their catalog and download tracks</p>
                                                </div>
                                            ) : (
                                                artistResults.map(a => (
                                                    <div key={a.id} className="mf-search-result mf-browse-card" onClick={() => openArtistDetail(a)}>
                                                        {a.thumbnail ? <img className="mf-search-thumb mf-search-thumb--round" src={a.thumbnail} alt="" /> : <div className="mf-search-thumb mf-search-thumb--placeholder"><Icon name="mic" size={16} /></div>}
                                                        <div className="mf-search-meta">
                                                            <span className="mf-truncate mf-search-title">{a.name}</span>
                                                        </div>
                                                        <Icon name="chevronRight" size={16} />
                                                    </div>
                                                ))
                                            )
                                        ) : searchResults.length === 0 ? (
                                            <div className="mf-empty-state">
                                                <Icon name="search" size={36} />
                                                <p>{searchQuery ? 'No results' : 'Find a song'}</p>
                                                <p className="mf-empty-hint">{searchQuery ? 'Try a different search' : 'Search by title, artist, or both'}</p>
                                            </div>
                                        ) : (
                                            searchResults.map(result => {
                                                const isDownloading = downloadingId === result.id;
                                                const isDownloaded = downloadedIds.includes(result.id);
                                                const isStreaming = streamingId === result.id;
                                                const isPlayingThis = currentTrack?.videoId === result.id && currentTrack?.streamed;
                                                return (
                                                    <div key={result.id} className="mf-search-result">
                                                        {result.thumbnail ? (
                                                            <img className="mf-search-thumb" src={result.thumbnail} alt="" />
                                                        ) : (
                                                            <div className="mf-search-thumb mf-search-thumb--placeholder"><Icon name="music" size={16} /></div>
                                                        )}
                                                        <div className="mf-search-meta">
                                                            <span className="mf-truncate mf-search-title">{result.title}</span>
                                                            <span className="mf-search-sub mf-truncate">{result.channel}{result.duration ? ` · ${result.duration}` : ''}</span>
                                                        </div>
                                                        {/* Feature 4/8: play instantly without saving a file */}
                                                        <button
                                                            className={`mf-btn-icon ${isPlayingThis ? 'mf-btn--accent' : ''}`}
                                                            onClick={() => playStreamed(result)}
                                                            disabled={isStreaming}
                                                            title={isPlayingThis ? 'Playing (streamed)' : 'Play without downloading'}
                                                        >
                                                            <Icon name={isStreaming ? 'spinner' : isPlayingThis ? 'pause' : 'play'} size={16} />
                                                        </button>
                                                        {/* Download button sits right next to play/pause, as requested */}
                                                        <button
                                                            className={`mf-btn-icon mf-search-dl ${isDownloaded ? 'mf-search-dl--done' : ''}`}
                                                            onClick={() => handleDownloadResult(result)}
                                                            disabled={isDownloading || isDownloaded}
                                                            title={isDownloaded ? 'Added to Auto Import' : 'Download & keep'}
                                                        >
                                                            <Icon name={isDownloading ? 'spinner' : isDownloaded ? 'check' : 'download'} size={16} />
                                                        </button>
                                                    </div>
                                                );
                                            })
                                        )}
                                        {searchMode === 'songs' && autoplaySimilar && currentTrack?.streamed && (relatedQueue.length > 0 || findingRelated) && (
                                            <div className="mf-related-block">
                                                <p className="mf-setting-title"><Icon name="radio" size={13} /> Up next (similar songs)</p>
                                                {findingRelated ? <p className="mf-empty-hint">Finding similar songs…</p> : (
                                                    relatedQueue.slice(0, 5).map(r => (
                                                        <div key={r.id} className="mf-search-result mf-related-item">
                                                            <span className="mf-truncate mf-search-title">{r.title}</span>
                                                            <span className="mf-search-sub mf-truncate">{r.channel}</span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : sidePanel === 'playlist' ? (
                                <>
                                    {/* Playlists list */}
                                    <div className="mf-playlist-header">
                                        <h3 className="mf-section-title">Playlists</h3>
                                        <div className="mf-icon-row">
                                            <button className="mf-btn-icon" onClick={createPlaylist} title="New"><Icon name="plus" size={15} /></button>
                                            <button className="mf-btn-icon" onClick={() => importInputRef.current?.click()} title="Import"><Icon name="upload" size={15} /></button>
                                            <input ref={importInputRef} type="file" accept=".json" className="mf-hidden" onChange={importPlaylist} />
                                        </div>
                                    </div>
                                    <div className="mf-playlist-list">
                                        {/* Feature 6: auto-import lives above user playlists, always in sync with the download folder */}
                                        <div className={`mf-playlist-item ${isAutoPlaylistActive ? 'mf-playlist-item--active' : ''}`} onClick={loadAutoPlaylist}>
                                            <Icon name="download" size={15} />
                                            <span className="mf-truncate" style={{ flex: 1 }}>Auto Import</span>
                                            <span className="mf-count-inline">({autoTracks.length})</span>
                                        </div>
                                        {playlists.map(pl => (
                                            <div key={pl.id} className={`mf-playlist-item ${activePlaylistId === pl.id ? 'mf-playlist-item--active' : ''}`} onClick={() => loadPlaylist(pl)}>
                                                <Icon name="folder" size={15} />
                                                {editingId === pl.id ? (
                                                    <>
                                                        <input className="mf-input-sm" value={editName} onClick={e => e.stopPropagation()} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveRename()} autoFocus />
                                                        <button className="mf-btn-icon" style={{ width: 24, height: 24 }} onClick={e => { e.stopPropagation(); saveRename(); }}><Icon name="check" size={14} /></button>
                                                        <button className="mf-btn-icon" style={{ width: 24, height: 24 }} onClick={e => { e.stopPropagation(); setEditingId(null); }}><Icon name="close" size={14} /></button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="mf-truncate">{pl.name}</span>
                                                        <span className="mf-count">{pl.tracks?.length || 0}</span>
                                                        <div className="mf-hover-actions">
                                                            <button onClick={e => { e.stopPropagation(); setEditingId(pl.id); setEditName(pl.name); }}><Icon name="edit" size={13} /></button>
                                                            <button onClick={e => { e.stopPropagation(); deletePlaylist(pl.id); }}><Icon name="trash" size={13} /></button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                        {playlists.length === 0 && <p className="mf-empty-text">No playlists yet</p>}
                                    </div>

                                    {/* Track list */}
                                    <div className="mf-playlist-header">
                                        <h3 className="mf-section-title">{activePL?.name || 'Queue'}<span className="mf-count-inline">({playlist.length})</span></h3>
                                        <div className="mf-icon-row">
                                            {!isAutoPlaylistActive && <button className="mf-btn-icon" onClick={() => fileInputRef.current?.click()} title="Add files"><Icon name="plus" size={15} /></button>}
                                            {isAutoPlaylistActive && <button className="mf-btn-icon" onClick={refreshAutoImport} title="Refresh"><Icon name="repeat" size={15} /></button>}
                                            {activePlaylistId && !isAutoPlaylistActive && playlist.length > 0 && <button className="mf-btn-icon" onClick={exportPlaylist} title="Export"><Icon name="download" size={15} /></button>}
                                            {/* Feature 5: local shuffle works for any playlist, including Auto Import */}
                                            <button className={`mf-btn-icon ${shuffle ? 'mf-btn--accent' : ''}`} onClick={() => setShuffle(!shuffle)} title="Shuffle this playlist"><Icon name="shuffle" size={15} /></button>
                                        </div>
                                        <input ref={fileInputRef} type="file" accept={ACCEPT} multiple className="mf-hidden" onChange={handleAddFiles} />
                                    </div>

                                    <div className="mf-track-list">
                                        {playlist.length === 0 ? (
                                            <div className="mf-empty-state">
                                                <Icon name="music" size={36} />
                                                <p>No tracks</p>
                                                <p className="mf-empty-hint">{isAutoPlaylistActive ? 'Download a song to see it here' : 'Click + to add media files'}</p>
                                            </div>
                                        ) : (
                                            playlist.map((track, idx) => (
                                                <div
                                                    key={track.id}
                                                    className={`mf-track-item ${idx === currentIndex ? 'mf-track-item--active' : ''}`}
                                                    draggable={!isAutoPlaylistActive}
                                                    onDragStart={() => { dragIndexRef.current = idx; }}
                                                    onDragOver={e => e.preventDefault()}
                                                    onDrop={e => { e.preventDefault(); handleReorder(dragIndexRef.current, idx); dragIndexRef.current = null; }}
                                                    onClick={() => playTrack(idx)}
                                                >
                                                    {!isAutoPlaylistActive && <span className="mf-drag-handle"><Icon name="drag" size={14} /></span>}
                                                    <Icon name={track.type?.startsWith('video') ? 'film' : 'music'} size={14} />
                                                    <span className="mf-truncate">{track.name}</span>
                                                    {track.source === 'local' && <span title="Imported file"><Icon name="folder" size={12} /></span>}
                                                    {!track.url && <span className="mf-unavailable">⚠</span>}
                                                    {!isAutoPlaylistActive && (
                                                        <button className="mf-track-remove" title="Remove from queue" onClick={e => { e.stopPropagation(); removeTrack(idx); }}>
                                                            <Icon name="trash" size={13} />
                                                        </button>
                                                    )}
                                                    {track.videoId && (
                                                        <button className="mf-track-delete" title="Delete file from disk" onClick={e => { e.stopPropagation(); deleteLibraryFile(track); }}>
                                                            <Icon name="trash" size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </>
                            ) : sidePanel === 'lyrics' ? (
                                <div className="mf-lyrics-panel">
                                    {!currentTrack ? (
                                        <div className="mf-empty-state">
                                            <Icon name="mic" size={36} />
                                            <p>No track playing</p>
                                        </div>
                                    ) : currentTrack.streamed ? (
                                        <div className="mf-empty-state">
                                            <Icon name="wifi" size={36} />
                                            <p>Lyrics unavailable</p>
                                            <p className="mf-empty-hint">This track is streaming, not downloaded — there's no saved song file or JSON to attach lyrics to. Download it first with the button next to Play.</p>
                                        </div>
                                    ) : (
                                        <>
                                            <h3 className="mf-section-title">Lyrics — <span className="mf-truncate">{currentTrack.name}</span></h3>
                                            <p className="mf-empty-hint">Add your own lyrics manually — nothing is fetched from an external API.</p>
                                            <textarea
                                                className="mf-lyrics-textarea"
                                                placeholder={lyricsLoading ? 'Loading…' : 'Paste or type lyrics here…'}
                                                value={lyricsDraft}
                                                onChange={e => setLyricsDraft(e.target.value)}
                                                disabled={lyricsLoading}
                                            />
                                            <button className="mf-btn mf-btn-primary" onClick={saveLyrics} disabled={lyricsLoading}>
                                                <Icon name={lyricsSaved ? 'check' : 'edit'} size={14} /> {lyricsSaved ? 'Saved' : 'Save Lyrics'}
                                            </button>
                                        </>
                                    )}
                                </div>
                            ) : (
                                /* Settings */
                                <div className="mf-settings">
                                    {/* Feature 3: custom download location */}
                                    <div className="mf-setting-section">
                                        <p className="mf-setting-title"><Icon name="folder" size={14} /> Download Location</p>
                                        <p className="mf-empty-hint">Where new downloads (and the Auto Import playlist) live on the server. Saving moves any existing files there too.</p>
                                        <div className="mf-dir-row">
                                            <input
                                                className="mf-input-sm mf-dir-input"
                                                value={downloadDirDraft}
                                                placeholder={downloadDir || 'e.g. /Users/you/Music/MediaFlow'}
                                                onChange={e => setDownloadDirDraft(e.target.value)}
                                            />
                                            <button className="mf-btn mf-btn-primary" onClick={saveDownloadDir} disabled={savingDir || !downloadDirDraft.trim()}>
                                                <Icon name={savingDir ? 'spinner' : 'check'} size={14} /> Save
                                            </button>
                                        </div>
                                        {downloadDir && <p className="mf-empty-hint">Current: {downloadDir}</p>}
                                        {dirStatus && <p className={dirStatus.ok ? 'mf-dir-ok' : 'mf-search-error'}>{dirStatus.msg}</p>}
                                        <button className="mf-btn mf-btn-danger" onClick={clearAllDownloads} disabled={clearingDownloads}>
                                            <Icon name={clearingDownloads ? 'spinner' : 'trash'} size={14} /> Clear All Downloads &amp; Temp
                                        </button>
                                    </div>

                                    <div className="mf-setting-row">
                                        <div className="mf-setting-label">
                                            <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={16} />
                                            <span>Dark Mode</span>
                                        </div>
                                        <Toggle on={theme === 'dark'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
                                    </div>

                                    <div className="mf-setting-row">
                                        <div className="mf-setting-label">
                                            <Icon name="radio" size={16} />
                                            <span>Autoplay similar songs (streamed)</span>
                                        </div>
                                        <Toggle on={autoplaySimilar} onClick={() => setAutoplaySimilar(!autoplaySimilar)} />
                                    </div>

                                    <div className="mf-setting-row">
                                        <div className="mf-setting-label">
                                            <Icon name={audioOnly ? 'eyeOff' : 'eye'} size={16} />
                                            <span>Audio Only Mode</span>
                                        </div>
                                        <Toggle on={audioOnly} onClick={() => setAudioOnly(!audioOnly)} />
                                    </div>

                                    <div className="mf-setting-section">
                                        <p className="mf-setting-title">Visualizer</p>
                                        <div className="mf-viz-grid">
                                            {VIZ_OPTIONS.map(({ key, label }) => (
                                                <button key={key} className={`mf-viz-btn ${visualizerStyle === key ? 'mf-viz-btn--active' : ''}`} onClick={() => setVisualizerStyle(key)}>
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mf-setting-row">
                                        <div className="mf-setting-label">
                                            <span style={{ fontSize: 18 }}>🐱</span>
                                            <span>Cats Mode</span>
                                        </div>
                                        <Toggle on={catsMode} onClick={() => { const v = !catsMode; setCatsMode(v); localStorage.setItem('cats-mode', String(v)); }} />
                                    </div>
                                    {catsMode && <p className="mf-cat-hint">🐱 Meow! Cats will appear randomly.</p>}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Main Area */}
            <div className="mf-main">
                {/* Top Bar */}
                <div className="mf-topbar">
                    <div>
                        {!sidePanel && (
                            <div className="mf-icon-row">
                                <button className="mf-btn-icon" onClick={() => setSidePanel('playlist')}><Icon name="list" size={18} /></button>
                                <button className="mf-btn-icon" onClick={() => setSidePanel('settings')}><Icon name="settings" size={18} /></button>
                            </div>
                        )}
                    </div>
                    <div className="mf-topbar-controls">
                        {/* Speed */}
                        <div className="mf-popover-wrap">
                            <button className="mf-chip" onClick={() => setOpenPanel(openPanel === 'speed' ? null : 'speed')}>
                                <Icon name="gauge" size={14} /> {playbackRate}x
                            </button>
                            {openPanel === 'speed' && (
                                <div className="mf-popover">
                                    <p className="mf-popover-title">Speed</p>
                                    <div className="mf-presets">
                                        {SPEED_PRESETS.map(s => (
                                            <button key={s} className={`mf-preset ${playbackRate === s ? 'mf-preset--active' : ''}`} onClick={() => setPlaybackRate(s)}>{s}x</button>
                                        ))}
                                    </div>
                                    <input type="range" className="mf-slider" min="0.25" max="3" step="0.05" value={playbackRate}
                                        onChange={e => setPlaybackRate(parseFloat(e.target.value))}
                                        style={{ '--fill': `${((playbackRate - 0.25) / 2.75) * 100}%` }} />
                                </div>
                            )}
                        </div>
                        {/* Pitch */}
                        <div className="mf-popover-wrap">
                            <button className="mf-chip" onClick={() => setOpenPanel(openPanel === 'pitch' ? null : 'pitch')}>
                                <Icon name="music" size={14} /> {pitch.toFixed(2)}
                            </button>
                            {openPanel === 'pitch' && (
                                <div className="mf-popover">
                                    <p className="mf-popover-title">Pitch</p>
                                    <input type="range" className="mf-slider" min="0.5" max="2" step="0.01" value={pitch}
                                        onChange={e => setPitch(parseFloat(e.target.value))}
                                        style={{ '--fill': `${((pitch - 0.5) / 1.5) * 100}%` }} />
                                    <div className="mf-popover-footer">
                                        <span>0.50</span>
                                        <button className="mf-reset-btn" onClick={() => setPitch(1)}>Reset</button>
                                        <span>2.00</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Display */}
                <div className="mf-display">
                    <div className="mf-display-frame">
                        <video
                            ref={mediaRef}
                            className={showVideo ? 'mf-video' : 'mf-hidden-video'}
                            crossOrigin="anonymous"
                            onTimeUpdate={() => setCurrentTime(mediaRef.current?.currentTime || 0)}
                            onDurationChange={() => setDuration(mediaRef.current?.duration || 0)}
                            onPlay={() => setIsPlaying(true)}
                            onPause={() => setIsPlaying(false)}
                            onEnded={handleEnded}
                            playsInline
                        />
                        {/* Feature 4: dedicated element for CORS-free streamed (not downloaded)
                            playback — kept out of the Web Audio graph on purpose. */}
                        <audio
                            ref={streamRef}
                            onTimeUpdate={() => { if (currentTrack?.streamed) setCurrentTime(streamRef.current?.currentTime || 0); }}
                            onDurationChange={() => { if (currentTrack?.streamed) setDuration(streamRef.current?.duration || 0); }}
                            onPlay={() => setIsPlaying(true)}
                            onPause={() => setIsPlaying(false)}
                            onEnded={handleEnded}
                        />
                        {showVisualizer && (
                            <>
                                <Visualizer analyserRef={analyserRef} style={visualizerStyle} theme={theme} simulated={!!currentTrack?.streamed} />
                                {currentTrack?.streamed && (
                                    <p className="mf-viz-sim-note">Simulated — real audio analysis isn't possible for streamed (not downloaded) tracks</p>
                                )}
                            </>
                        )}
                        {!currentTrack && (
                            <div className="mf-empty-display">
                                <Icon name="music" size={56} />
                                <p className="mf-empty-title">No track loaded</p>
                                <p className="mf-empty-hint">Open the playlist panel to add media files</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Now Playing */}
                {currentTrack && (
                    <div className="mf-now-playing">
                        <span className="mf-truncate">{currentTrack.name}</span>
                        {currentTrack.streamed && <span className="mf-stream-badge" title="Playing directly from YouTube, not downloaded"><Icon name="wifi" size={11} /> streaming</span>}
                        <button className="mf-btn-icon" style={{ width: 24, height: 24, marginLeft: 'auto' }} onClick={() => setSidePanel('lyrics')} title="Lyrics">
                            <Icon name="mic" size={14} />
                        </button>
                    </div>
                )}

                {/* Controls */}
                <div className="mf-controls">
                    {/* Seek */}
                    <div className="mf-seek-bar">
                        <input type="range" className="mf-slider mf-seek-slider" min={0} max={duration || 1} step={0.1} value={currentTime}
                            onChange={e => seek(parseFloat(e.target.value))}
                            style={{ '--fill': `${duration ? (currentTime / duration) * 100 : 0}%` }}
                        />
                        <div className="mf-time-row">
                            <span className="mf-time">{formatTime(currentTime)}</span>
                            <span className="mf-time">{formatTime(duration)}</span>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="mf-buttons">
                        <button className={`mf-btn-icon ${shuffle ? 'mf-btn--accent' : ''}`} onClick={() => setShuffle(!shuffle)} title="Shuffle"><Icon name="shuffle" size={16} /></button>
                        <button className="mf-btn-icon" onClick={() => skip(-10)} title="-10s"><Icon name="rewind" size={16} /></button>
                        <button className="mf-btn-icon mf-btn-md" onClick={playPrev} title="Previous"><Icon name="prev" size={20} /></button>
                        <button className="mf-btn-play" onClick={togglePlay} title="Play/Pause"><Icon name={isPlaying ? 'pause' : 'play'} size={22} /></button>
                        {/* Feature 8: keep (download) a streamed track right next to play/pause */}
                        {currentTrack?.streamed && (
                            <button
                                className={`mf-btn-icon mf-btn-md ${downloadedIds.includes(currentTrack.videoId) ? 'mf-search-dl--done' : ''}`}
                                onClick={keepCurrentStreamedTrack}
                                disabled={downloadingId === currentTrack.videoId || downloadedIds.includes(currentTrack.videoId)}
                                title={downloadedIds.includes(currentTrack.videoId) ? 'Downloaded' : 'Like it? Download this track'}
                            >
                                <Icon name={downloadingId === currentTrack.videoId ? 'spinner' : downloadedIds.includes(currentTrack.videoId) ? 'check' : 'download'} size={16} />
                            </button>
                        )}
                        <button className="mf-btn-icon mf-btn-md" onClick={stop} title="Stop"><Icon name="stop" size={18} /></button>
                        <button className="mf-btn-icon mf-btn-md" onClick={playNext} title="Next"><Icon name="next" size={20} /></button>
                        <button className="mf-btn-icon" onClick={() => skip(10)} title="+10s"><Icon name="forward" size={16} /></button>
                        <button className={`mf-btn-icon ${loopMode !== 'none' ? 'mf-btn--accent' : ''}`} onClick={cycleLoop} title="Loop"><Icon name={loopMode === 'one' ? 'repeatOne' : 'repeat'} size={16} /></button>
                    </div>

                    {/* Volume */}
                    <div className="mf-volume">
                        <button className="mf-btn-icon" onClick={toggleMute} title="Mute"><Icon name={isMuted || volume === 0 ? 'volumeMute' : 'volume'} size={18} /></button>
                        <input type="range" className="mf-slider mf-volume-slider" min={0} max={2} step={0.01} value={isMuted ? 0 : volume}
                            onChange={e => changeVolume(parseFloat(e.target.value))}
                            style={{ '--fill': `${(isMuted ? 0 : volume) / 2 * 100}%` }}
                        />
                        <span className="mf-vol-pct">{Math.round((isMuted ? 0 : volume) * 100)}%</span>
                    </div>
                </div>
            </div>
        </div>
    );
}