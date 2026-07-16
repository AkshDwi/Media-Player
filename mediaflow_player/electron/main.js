import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import net from 'net';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

let mainWindow;
let nodeServerProcess;
let pythonServerProcess;

// In dev, backend files live in the repo; in a packaged app they're copied
// into resources/server (see the "extraResources" block in package.json).
function resourcePath(...segments) {
    return isDev
        ? path.join(__dirname, '..', 'server', ...segments)
        : path.join(process.resourcesPath, 'server', ...segments);
}

function platformBinName(base) {
    return process.platform === 'win32' ? `${base}.exe` : base;
}

// Runs the Express (ytget) server using Electron's own bundled Node runtime,
// so a separate Node.js install isn't required on the user's machine.
function startNodeServer() {
    const serverDir = resourcePath();
    nodeServerProcess = spawn(process.execPath, [path.join(serverDir, 'index.js')], {
        cwd: serverDir,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PORT: '3001' },
        stdio: 'pipe',
    });
    nodeServerProcess.stdout?.on('data', d => console.log('[ytget-server]', d.toString().trim()));
    nodeServerProcess.stderr?.on('data', d => console.error('[ytget-server]', d.toString().trim()));
    nodeServerProcess.on('error', err => console.error('Could not start the Node server:', err));
}

// Runs the Flask/yt-dlp server. Prefers a PyInstaller-built binary (fully
// self-contained, no Python install needed) if one was bundled for this
// platform; otherwise falls back to system Python (dev machines, or any
// platform we haven't built a binary for yet).
function startPythonServer() {
    const serverDir = resourcePath();
    const bundledBinary = path.join(serverDir, 'bin', platformBinName('mediaflow-audio-server'));

    let cmd, args;
    if (!isDev && fs.existsSync(bundledBinary)) {
        cmd = bundledBinary;
        args = [];
    } else {
        cmd = process.platform === 'win32' ? 'python' : 'python3';
        args = [path.join(serverDir, 'app.py')];
    }

    // app.py defaults to ~/Music/mediaflow_player on its own now (writable
    // everywhere, no permissions issues) — no need to compute or pass a
    // data directory from here anymore.
    pythonServerProcess = spawn(cmd, args, { cwd: serverDir, stdio: 'pipe' });
    pythonServerProcess.stdout?.on('data', d => console.log('[audio-server]', d.toString().trim()));
    pythonServerProcess.stderr?.on('data', d => console.error('[audio-server]', d.toString().trim()));
    pythonServerProcess.on('error', err => {
        console.error(
            'Could not start the Python audio server. If no bundled binary exists ' +
            'for this platform, Python 3 needs to be installed and on PATH.',
            err
        );
    });
}

function waitForPort(port, timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        (function attempt() {
            const socket = net.createConnection(port, '127.0.0.1');
            socket.once('connect', () => { socket.end(); resolve(); });
            socket.once('error', () => {
                socket.destroy();
                if (Date.now() - start > timeoutMs) reject(new Error(`Timed out waiting for port ${port}`));
                else setTimeout(attempt, 300);
            });
        })();
    });
}

async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 860,
        minHeight: 600,
        title: 'MediaFlow Player',
        backgroundColor: '#0b0b0f',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    // Electron normally syncs the window title to the page's <title> tag —
    // whatever that currently says ("musoplayer" or otherwise), this keeps
    // the window titled "MediaFlow Player" regardless. It's still worth
    // fixing the <title> tag in index.html directly for the browser-tab /
    // taskbar-preview case, but this covers the actual window chrome either way.
    mainWindow.on('page-title-updated', e => e.preventDefault());

    // Open any target="_blank"/external links in the OS browser, not inside the app window.
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    if (isDev) {
        await mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    }
}

app.whenReady().then(async () => {
    startNodeServer();
    startPythonServer();
    try {
        await Promise.all([waitForPort(3001), waitForPort(5000)]);
    } catch (err) {
        console.error('Backend services did not start in time — the app will still open, but search/download/streaming may not work yet:', err);
    }
    await createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    nodeServerProcess?.kill();
    pythonServerProcess?.kill();
});