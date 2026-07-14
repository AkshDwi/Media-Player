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
];
const API_BASE = import.meta.env?.VITE_API_URL || 'http://localhost:3001';

/* ===== Helpers ===== */
const formatTime = s => (!s || !isFinite(s)) ? '0:00' : `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const loadData = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { playlists: [] }; } catch { return { playlists: [] }; } };
const saveData = d => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch { } };

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
};

function Icon({ name, size = 18 }) {
    const I = ICONS[name];
    if (!I) return null;
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...(name === 'spinner' ? { 'data-spin': true } : {})}>
            <I />
        </svg>
    );
}

/* ===== Visualizer (canvas + Web Audio Analyser) ===== */
function Visualizer({ analyserRef, style, theme }) {
    const canvasRef = useRef(null);
    const particlesRef = useRef([]);
    const animRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

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
            if (!analyser) return;

            const bufLen = analyser.frequencyBinCount;
            const data = new Uint8Array(bufLen);
            const rgb = theme === 'dark' ? '129, 140, 248' : '99, 102, 241';

            if (style === 'bars') {
                analyser.getByteFrequencyData(data);
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
                analyser.getByteFrequencyData(data);
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
                analyser.getByteTimeDomainData(data);
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
                analyser.getByteFrequencyData(data);
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
            }
        };

        draw();
        return () => cancelAnimationFrame(animRef.current);
    }, [style, theme, analyserRef]);

    return <canvas ref={canvasRef} className="mf-visualizer" />;
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
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState(null);
    const [downloadingId, setDownloadingId] = useState(null);
    const [downloadedIds, setDownloadedIds] = useState([]);

    // --- Refs ---
    const mediaRef = useRef(null);
    const audioCtxRef = useRef(null);
    const analyserRef = useRef(null);
    const gainRef = useRef(null);
    const fileInputRef = useRef(null);
    const importInputRef = useRef(null);
    const dragIndexRef = useRef(null);
    const prevVolumeRef = useRef(1);
    const keyHandlerRef = useRef(() => { });

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

    // --- Apply pitch & speed to media element ---
    useEffect(() => {
        const el = mediaRef.current;
        if (!el) return;
        const setPP = v => {
            if ('preservesPitch' in el) el.preservesPitch = v;
            if ('mozPreservesPitch' in el) el.mozPreservesPitch = v;
            if ('webkitPreservesPitch' in el) el.webkitPreservesPitch = v;
        };
        if (pitch === 1) { el.playbackRate = playbackRate; setPP(true); }
        else { el.playbackRate = playbackRate * pitch; setPP(false); }
    }, [playbackRate, pitch]);

    // --- Theme ---
    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('player-theme', theme);
    }, [theme]);

    // --- Load saved playlists on mount ---
    useEffect(() => { setPlaylists(loadData().playlists || []); }, []);

    // --- Save playlists when changed ---
    useEffect(() => { saveData({ playlists }); }, [playlists]);

    // --- Update keyboard handler ref (always has latest state) ---
    keyHandlerRef.current = e => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        switch (e.key) {
            case ' ': e.preventDefault(); if (currentIndex >= 0) togglePlay(); break;
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
        const el = mediaRef.current;
        if (!el || !currentTrack) return;
        initAudio();
        if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
        if (isPlaying) el.pause(); else el.play().catch(() => { });
    }

    function stop() {
        const el = mediaRef.current;
        if (!el) return;
        el.pause(); el.currentTime = 0;
        setIsPlaying(false); setCurrentTime(0);
    }

    function seek(t) {
        const el = mediaRef.current;
        if (!el) return;
        el.currentTime = t; setCurrentTime(t);
    }

    function skip(sec) {
        const el = mediaRef.current;
        if (!el) return;
        el.currentTime = Math.max(0, Math.min(el.currentTime + sec, el.duration || 0));
    }

    function changeVolume(vol) {
        setVolume(vol); setIsMuted(vol === 0); prevVolumeRef.current = vol;
        if (gainRef.current) gainRef.current.gain.value = vol;
        else if (mediaRef.current) mediaRef.current.volume = Math.min(vol, 1);
    }

    function toggleMute() {
        if (isMuted) { changeVolume(prevVolumeRef.current || 1); setIsMuted(false); }
        else { prevVolumeRef.current = volume; setIsMuted(true); if (gainRef.current) gainRef.current.gain.value = 0; else if (mediaRef.current) mediaRef.current.volume = 0; }
    }

    function playTrackAt(index, list) {
        const track = list[index];
        if (!track || !track.url) return;
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
        const el = mediaRef.current;
        if (el && el.currentTime > 3) { el.currentTime = 0; return; }
        let prev;
        if (shuffle) prev = Math.floor(Math.random() * playlist.length);
        else {
            prev = currentIndex - 1;
            if (prev < 0) prev = loopMode === 'all' ? playlist.length - 1 : 0;
        }
        playTrack(prev);
    }

    function handleEnded() {
        if (loopMode === 'one') { seek(0); mediaRef.current?.play().catch(() => { }); }
        else playNext();
    }

    /* --- File & Playlist Management --- */
    function handleAddFiles(e) {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        const newTracks = files.map(f => ({
            id: uid(),
            name: f.name.replace(/\.[^/.]+$/, ''),
            type: f.type || (/\.(mp4|mkv|avi|mov|webm|wmv|flv|mpeg)$/i.test(f.name) ? 'video' : 'audio'),
            url: URL.createObjectURL(f),
        }));
        const updated = [...playlist, ...newTracks];
        setPlaylist(updated);
        if (activePlaylistId) updatePlaylistData(activePlaylistId, { tracks: updated });
        if (currentIndex === -1) playTrackAt(playlist.length, updated);
        e.target.value = '';
    }

    function updatePlaylistData(id, data) {
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
        const updated = playlist.filter((_, i) => i !== idx);
        let newIndex = currentIndex;
        if (idx < currentIndex) newIndex--;
        else if (idx === currentIndex) newIndex = -1;
        setPlaylist(updated); setCurrentIndex(newIndex);
        if (newIndex === -1) {
            setCurrentTrack(null); setIsPlaying(false);
            if (mediaRef.current) { mediaRef.current.pause(); mediaRef.current.src = ''; }
        }
        if (activePlaylistId) updatePlaylistData(activePlaylistId, { tracks: updated });
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
        if (activePlaylistId) updatePlaylistData(activePlaylistId, { tracks: items });
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

    /* --- Auto-import previously downloaded songs on load --- */
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/api/library`);
                if (!res.ok) return;
                const data = await res.json();
                const files = data.files || [];
                if (!files.length) return;

                setPlaylist(prev => {
                    const existingUrls = new Set(prev.map(t => t.url));
                    const newTracks = files
                        .filter(f => !existingUrls.has(f.audioUrl))
                        .map(f => ({ id: uid(), name: f.title || f.videoId, type: 'audio', url: f.audioUrl }));
                    if (!newTracks.length) return prev;
                    const merged = [...prev, ...newTracks];
                    if (activePlaylistId) updatePlaylistData(activePlaylistId, { tracks: merged });
                    return merged;
                });
            } catch (err) {
                console.warn('Auto-import from library failed (is the Python server running?):', err);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* --- Song Search & Download --- */
    async function handleSearch(e) {
        e?.preventDefault();
        const q = searchQuery.trim();
        if (!q || isSearching) return;
        setIsSearching(true);
        setSearchError(null);
        try {
            const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(q)}`);
            if (!res.ok) throw new Error('Search request failed');
            const data = await res.json();
            setSearchResults(data.results || []);
        } catch (err) {
            console.warn('Search failed:', err);
            setSearchError('Could not search right now. Is the server running?');
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    }

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

            const track = {
                id: uid(),
                name: data.title || result.title,
                type: 'audio',
                url: data.audioUrl,
            };
            const updated = [...playlist, track];
            setPlaylist(updated);
            if (activePlaylistId) updatePlaylistData(activePlaylistId, { tracks: updated });
            if (currentIndex === -1) playTrackAt(playlist.length, updated);
            setDownloadedIds(prev => [...prev, result.id]);
        } catch (err) {
            console.warn('Download failed:', err);
            setSearchError(err.message || 'Download failed. Please try again.');
        } finally {
            setDownloadingId(null);
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
    const activePL = playlists.find(p => p.id === activePlaylistId);

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
                                    <form className="mf-search-form" onSubmit={handleSearch}>
                                        <div className="mf-search-input-wrap">
                                            <Icon name="search" size={15} />
                                            <input
                                                className="mf-search-input"
                                                placeholder="Search for a song..."
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                                autoFocus
                                            />
                                            {searchQuery && (
                                                <button type="button" className="mf-search-clear" onClick={() => { setSearchQuery(''); setSearchResults([]); setSearchError(null); }}>
                                                    <Icon name="close" size={13} />
                                                </button>
                                            )}
                                        </div>
                                        <button type="submit" className="mf-btn-icon mf-search-go" disabled={isSearching || !searchQuery.trim()} title="Search">
                                            <Icon name={isSearching ? 'spinner' : 'search'} size={16} />
                                        </button>
                                    </form>

                                    {searchError && <p className="mf-search-error">{searchError}</p>}

                                    <div className="mf-track-list mf-search-results">
                                        {isSearching ? (
                                            <div className="mf-empty-state">
                                                <Icon name="spinner" size={32} />
                                                <p>Searching…</p>
                                            </div>
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
                                                        <button
                                                            className={`mf-btn-icon mf-search-dl ${isDownloaded ? 'mf-search-dl--done' : ''}`}
                                                            onClick={() => handleDownloadResult(result)}
                                                            disabled={isDownloading || isDownloaded}
                                                            title={isDownloaded ? 'Added to playlist' : 'Download & add to playlist'}
                                                        >
                                                            <Icon name={isDownloading ? 'spinner' : isDownloaded ? 'check' : 'download'} size={16} />
                                                        </button>
                                                    </div>
                                                );
                                            })
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
                                            <button className="mf-btn-icon" onClick={() => fileInputRef.current?.click()} title="Add files"><Icon name="plus" size={15} /></button>
                                            {activePlaylistId && playlist.length > 0 && <button className="mf-btn-icon" onClick={exportPlaylist} title="Export"><Icon name="download" size={15} /></button>}
                                        </div>
                                        <input ref={fileInputRef} type="file" accept={ACCEPT} multiple className="mf-hidden" onChange={handleAddFiles} />
                                    </div>

                                    <div className="mf-track-list">
                                        {playlist.length === 0 ? (
                                            <div className="mf-empty-state">
                                                <Icon name="music" size={36} />
                                                <p>No tracks</p>
                                                <p className="mf-empty-hint">Click + to add media files</p>
                                            </div>
                                        ) : (
                                            playlist.map((track, idx) => (
                                                <div
                                                    key={track.id}
                                                    className={`mf-track-item ${idx === currentIndex ? 'mf-track-item--active' : ''}`}
                                                    draggable
                                                    onDragStart={() => { dragIndexRef.current = idx; }}
                                                    onDragOver={e => e.preventDefault()}
                                                    onDrop={e => { e.preventDefault(); handleReorder(dragIndexRef.current, idx); dragIndexRef.current = null; }}
                                                    onClick={() => playTrack(idx)}
                                                >
                                                    <span className="mf-drag-handle"><Icon name="drag" size={14} /></span>
                                                    <Icon name={track.type?.startsWith('video') ? 'film' : 'music'} size={14} />
                                                    <span className="mf-truncate">{track.name}</span>
                                                    {!track.url && <span className="mf-unavailable">⚠</span>}
                                                    <button className="mf-track-remove" onClick={e => { e.stopPropagation(); removeTrack(idx); }}>
                                                        <Icon name="trash" size={13} />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </>
                            ) : (
                                /* Settings */
                                <div className="mf-settings">
                                    <div className="mf-setting-row">
                                        <div className="mf-setting-label">
                                            <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={16} />
                                            <span>Dark Mode</span>
                                        </div>
                                        <Toggle on={theme === 'dark'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
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
                        {showVisualizer && <Visualizer analyserRef={analyserRef} style={visualizerStyle} theme={theme} />}
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