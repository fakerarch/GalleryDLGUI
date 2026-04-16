const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const os = require('os');

// Config file path
const CONFIG_PATH = path.join(app.getPath('userData'), 'presets.json');

let mainWindow;
let activeProcess = null;

// ── gallery-dl dependency check ───────────────────────────────────────────────

/**
 * Resolve the gallery-dl executable name/path.
 * On Windows we also check next to the app exe in case it was installed by NSIS.
 */
function resolveGalleryDl() {
  if (process.platform === 'win32') {
    // Check next to the app executable (installed by NSIS alongside the app)
    const siblingExe = path.join(path.dirname(process.execPath), 'gallery-dl.exe');
    if (fs.existsSync(siblingExe)) return siblingExe;
    return 'gallery-dl.exe';
  }
  // Linux/macOS: also check $HOME/.local/bin (pip --user install target)
  const userBin = path.join(os.homedir(), '.local', 'bin', 'gallery-dl');
  if (fs.existsSync(userBin)) return userBin;
  return 'gallery-dl';
}

function checkGalleryDlInstalled() {
  return new Promise((resolve) => {
    const gdl = resolveGalleryDl();
    const p = spawn(gdl, ['--version'], { stdio: 'pipe' });
    p.on('close', code => resolve({ found: code === 0, executable: gdl }));
    p.on('error', () => resolve({ found: false, executable: gdl }));
  });
}

async function showMissingGalleryDlDialog() {
  const isWin = process.platform === 'win32';
  const installCmd = isWin
    ? 'winget install mikf.gallery-dl   (or: pip install gallery-dl)'
    : 'pip install gallery-dl   (or: pipx install gallery-dl)';

  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'gallery-dl not found',
    message: 'gallery-dl is not installed or not in your PATH.',
    detail:
      `gallery-dl GUI is a frontend for the gallery-dl command-line tool.\n\n` +
      `To install gallery-dl, open a terminal and run:\n\n  ${installCmd}\n\n` +
      `After installing, restart the app.\n\n` +
      (isWin
        ? `On Windows you can also download gallery-dl.exe from:\n  https://github.com/mikf/gallery-dl/releases\nand place it next to this application.`
        : `On Linux you can also download the standalone binary from:\n  https://github.com/mikf/gallery-dl/releases`),
    buttons: ['Open Releases Page', 'Dismiss'],
    defaultId: 1,
    cancelId: 1,
  });

  if (response === 0) {
    shell.openExternal('https://github.com/mikf/gallery-dl/releases');
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0f0f11',
    titleBarStyle: process.platform === 'win32' ? 'default' : 'hiddenInset',
    frame: process.platform !== 'linux',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(async () => {
  createWindow();

  // Non-blocking check: warn user if gallery-dl is missing
  const { found } = await checkGalleryDlInstalled();
  if (!found) {
    // Wait for window to fully load before showing dialog
    mainWindow.webContents.once('did-finish-load', () => {
      showMissingGalleryDlDialog();
    });
  }
});

app.on('window-all-closed', () => {
  if (activeProcess) activeProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

// ── Presets ──────────────────────────────────────────────────────────────────

function loadPresets() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch {}
  return [
    { id: 'default', name: 'Default', flags: '' },
    { id: 'no-metadata', name: 'No Metadata', flags: '--no-mtime --no-part' },
    { id: 'zip', name: 'ZIP Archive', flags: '--zip' },
  ];
}

function savePresets(presets) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(presets, null, 2));
}

ipcMain.handle('get-presets', () => loadPresets());

ipcMain.handle('save-presets', (_, presets) => {
  savePresets(presets);
  return true;
});

// ── Download ──────────────────────────────────────────────────────────────────

// Strip null bytes and other control characters from a string
function sanitize(str) {
  // eslint-disable-next-line no-control-regex
  return String(str).replace(/\x00/g, '').replace(/[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').trim();
}

ipcMain.handle('start-download', (_, { urls, flags, outputDir, convertM4s }) => {
  if (activeProcess) {
    activeProcess.kill();
    activeProcess = null;
  }

  const args = [];

  // Output directory
  if (outputDir) args.push('--destination', sanitize(outputDir));

  // Parse extra flags from preset — handle quoted -o "key=val" style args
  if (flags && flags.trim()) {
    // Split respecting quoted segments (e.g. -o "key=val")
    const flagStr = sanitize(flags);
    const parts = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < flagStr.length; i++) {
      const c = flagStr[i];
      if (c === '"' && !inQuote) { inQuote = true; continue; }
      if (c === '"' && inQuote) { inQuote = false; if (current) { parts.push(current); current = ''; } continue; }
      if (c === ' ' && !inQuote) { if (current) { parts.push(current); current = ''; } continue; }
      current += c;
    }
    if (current) parts.push(current);
    parts.forEach(f => args.push(f));
  }

  // Add all URLs — sanitize each one
  urls.forEach(u => {
    const clean = sanitize(u);
    if (clean) args.push(clean);
  });

  // Try to find gallery-dl (uses smart resolution — sibling exe on Windows, ~/.local/bin on Linux)
  const gdl = resolveGalleryDl();

  try {
    activeProcess = spawn(gdl, args, {
      env: { ...process.env },
    });

    activeProcess.stdout.on('data', (data) => {
      mainWindow.webContents.send('download-output', { type: 'stdout', text: data.toString() });
    });

    activeProcess.stderr.on('data', (data) => {
      mainWindow.webContents.send('download-output', { type: 'stderr', text: data.toString() });
    });

    activeProcess.on('close', async (code) => {
      if (convertM4s && outputDir) {
        await convertM4sFiles(outputDir, mainWindow);
      }
      mainWindow.webContents.send('download-done', { code });
      activeProcess = null;
    });

    activeProcess.on('error', (err) => {
      mainWindow.webContents.send('download-output', {
        type: 'error',
        text: `Failed to start gallery-dl: ${err.message}\nMake sure gallery-dl is installed and in your PATH.\n`,
      });
      mainWindow.webContents.send('download-done', { code: -1 });
      activeProcess = null;
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('stop-download', () => {
  if (activeProcess) {
    activeProcess.kill();
    activeProcess = null;
    return true;
  }
  return false;
});

// ── M4S → MP4 conversion & M4V → MP4 rename ──────────────────────────────────

function findFilesByExt(dir, extensions) {
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        results.push(...findFilesByExt(full, extensions));
      } else if (e.isFile() && extensions.some(ext => e.name.toLowerCase().endsWith(ext))) {
        results.push(full);
      }
    }
  } catch {}
  return results;
}

async function convertM4sFiles(dir, win) {
  const send = (text, type = 'info') => win.webContents.send('download-output', { type, text });

  // ── m4v → mp4: simple rename, no FFmpeg needed ──
  const m4vFiles = findFilesByExt(dir, ['.m4v']);
  if (m4vFiles.length) {
    send(`\n📁 Found ${m4vFiles.length} .m4v file(s) — renaming to .mp4...\n`, 'info');
    for (const m4vPath of m4vFiles) {
      const mp4Path = m4vPath.replace(/\.m4v$/i, '.mp4');
      try {
        fs.renameSync(m4vPath, mp4Path);
        send(`  ✓ ${path.basename(m4vPath)}  →  ${path.basename(mp4Path)}`, 'success');
      } catch (err) {
        send(`  ✗ ${path.basename(m4vPath)}: ${err.message}`, 'error');
      }
    }
  }

  // ── m4s → mp4: needs FFmpeg remux ──
  const m4sFiles = findFilesByExt(dir, ['.m4s']);
  if (!m4sFiles.length) return;

  send(`\n🎬 Found ${m4sFiles.length} .m4s file(s) — converting to MP4...\n`, 'info');

  for (const m4sPath of m4sFiles) {
    const mp4Path = m4sPath.replace(/\.m4s$/i, '.mp4');
    send(`  → ${path.basename(m4sPath)}`, 'info');

    await new Promise((resolve) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i', m4sPath,
        '-c', 'copy',
        mp4Path,
      ]);

      let errBuf = '';
      ffmpeg.stderr.on('data', d => { errBuf += d.toString(); });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          send(`    ✓ Saved as ${path.basename(mp4Path)}`, 'success');
          try { fs.unlinkSync(m4sPath); } catch {}
        } else {
          send(`    ✗ FFmpeg failed (code ${code})`, 'stderr');
          const lastLine = errBuf.trim().split('\n').pop();
          if (lastLine) send(`      ${lastLine}`, 'stderr');
        }
        resolve();
      });

      ffmpeg.on('error', (err) => {
        if (err.code === 'ENOENT') {
          send('    ✗ FFmpeg not found — install it and make sure it is in your PATH', 'error');
        } else {
          send(`    ✗ ${err.message}`, 'error');
        }
        resolve();
      });
    });
  }

  send(`\n✓ Conversion complete\n`, 'success');
}

ipcMain.handle('check-gallery-dl', async () => {
  return checkGalleryDlInstalled();
});

ipcMain.handle('check-ffmpeg', () => {
  return new Promise((resolve) => {
    const p = spawn('ffmpeg', ['-version']);
    p.on('close', code => resolve(code === 0));
    p.on('error', () => resolve(false));
  });
});

ipcMain.handle('check-ytdlp', () => {
  return new Promise((resolve) => {
    const p = spawn('yt-dlp', ['--version']);
    p.on('close', code => resolve(code === 0));
    p.on('error', () => resolve(false));
  });
});

// ── Dependency installers ─────────────────────────────────────────────────────

function sendInstallProgress(text, type = 'info') {
  if (mainWindow) mainWindow.webContents.send('install-progress', { text, type });
}

ipcMain.handle('install-ytdlp', async () => {
  const binDir  = path.join(os.homedir(), '.local', 'bin');
  const binPath = path.join(binDir, 'yt-dlp');
  const url     = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

  try { fs.mkdirSync(binDir, { recursive: true }); } catch {}

  sendInstallProgress('Downloading yt-dlp from GitHub releases...');

  return new Promise((resolve) => {
    const curl = spawn('curl', ['-L', '--progress-bar', url, '-o', binPath], { stdio: ['ignore', 'pipe', 'pipe'] });

    curl.stdout.on('data', d => sendInstallProgress(d.toString().trim()));
    curl.stderr.on('data', d => sendInstallProgress(d.toString().trim()));

    curl.on('close', (code) => {
      if (code === 0) {
        try { fs.chmodSync(binPath, 0o755); } catch {}
        sendInstallProgress(`✓ yt-dlp installed to ${binPath}`, 'success');
        resolve({ ok: true });
      } else {
        sendInstallProgress('✗ Download failed — check your internet connection.', 'error');
        resolve({ ok: false });
      }
    });

    curl.on('error', (err) => {
      sendInstallProgress(`✗ ${err.message}`, 'error');
      resolve({ ok: false });
    });
  });
});

ipcMain.handle('install-ffmpeg', async () => {
  // Detect available package manager
  const managers = [
    { bin: 'apt-get', args: ['apt-get', 'install', '-y', 'ffmpeg'] },
    { bin: 'dnf',     args: ['dnf',     'install', '-y', 'ffmpeg'] },
    { bin: 'pacman',  args: ['pacman',  '-S', '--noconfirm', 'ffmpeg'] },
    { bin: 'zypper',  args: ['zypper',  'install', '-y', 'ffmpeg'] },
  ];

  let pm = null;
  for (const m of managers) {
    const found = await new Promise(r => {
      const p = spawn('which', [m.bin]);
      p.on('close', code => r(code === 0));
      p.on('error', () => r(false));
    });
    if (found) { pm = m; break; }
  }

  if (!pm) {
    sendInstallProgress('✗ No supported package manager found (apt-get, dnf, pacman, zypper).', 'error');
    sendInstallProgress('Install ffmpeg manually from https://ffmpeg.org/download.html', 'info');
    return { ok: false };
  }

  sendInstallProgress(`Installing ffmpeg via ${pm.bin} — a password prompt may appear...`);

  return new Promise((resolve) => {
    // pkexec shows a native graphical sudo dialog
    const proc = spawn('pkexec', pm.args, { stdio: ['ignore', 'pipe', 'pipe'] });

    proc.stdout.on('data', d => sendInstallProgress(d.toString().trim()));
    proc.stderr.on('data', d => sendInstallProgress(d.toString().trim()));

    proc.on('close', (code) => {
      if (code === 0) {
        sendInstallProgress('✓ ffmpeg installed successfully.', 'success');
        resolve({ ok: true });
      } else if (code === 126) {
        sendInstallProgress('✗ Password entry was cancelled.', 'error');
        resolve({ ok: false });
      } else {
        sendInstallProgress(`✗ Installation failed (exit code ${code}).`, 'error');
        resolve({ ok: false });
      }
    });

    proc.on('error', (err) => {
      sendInstallProgress(`✗ ${err.message}`, 'error');
      resolve({ ok: false });
    });
  });
});

ipcMain.handle('convert-files', async (_, dir) => {
  await convertM4sFiles(dir, mainWindow);
});

// ── gallery-dl config file read/write ─────────────────────────────────────────

function getGdlConfigPath() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || os.homedir(), 'gallery-dl', 'config.json');
  }
  return path.join(os.homedir(), '.config', 'gallery-dl', 'config.json');
}

ipcMain.handle('read-gdl-config', async () => {
  const configPath = getGdlConfigPath();
  console.log('[config] Reading from:', configPath);
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      console.log('[config] Read OK, length:', content.length);
      return { ok: true, content, path: configPath };
    }
    console.log('[config] File not found, returning empty');
    return { ok: true, content: '{\n    \n}', path: configPath };
  } catch (err) {
    console.error('[config] Read error:', err.message);
    return { ok: false, error: err.message, path: configPath };
  }
});

ipcMain.handle('write-gdl-config', async (_, content) => {
  const configPath = getGdlConfigPath();
  console.log('[config] Writing to:', configPath);
  try {
    JSON.parse(content); // validate
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, content, 'utf8');
    console.log('[config] Write OK');
    return { ok: true, path: configPath };
  } catch (err) {
    console.error('[config] Write error:', err.message);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('patch-gdl-config', async (_, patch) => {
  const configPath = getGdlConfigPath();
  console.log('[config] Patching:', configPath, 'with:', JSON.stringify(patch));
  try {
    let existing = {};
    if (fs.existsSync(configPath)) {
      existing = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    function deepMerge(target, source) {
      for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          target[key] = target[key] || {};
          deepMerge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
      return target;
    }
    deepMerge(existing, patch);
    const output = JSON.stringify(existing, null, 4);
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, output, 'utf8');
    console.log('[config] Patch OK, wrote:', output);
    return { ok: true, content: output, path: configPath };
  } catch (err) {
    console.error('[config] Patch error:', err.message);
    return { ok: false, error: err.message };
  }
});

// ── Utilities ─────────────────────────────────────────────────────────────────

ipcMain.handle('open-folder', (_, dirPath) => {
  shell.openPath(dirPath);
});

ipcMain.handle('get-default-dir', () => {
  return path.join(os.homedir(), 'Downloads');
});

ipcMain.handle('pick-folder', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('pick-file-save', async (_, ext) => {
  const { dialog } = require('electron');
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: ext ? ext.toUpperCase() + ' files' : 'All files', extensions: ext ? [ext] : ['*'] }],
  });
  if (!result.canceled && result.filePath) return result.filePath;
  return null;
});

ipcMain.handle('pick-file', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Cookie files', extensions: ['txt', '*'] }],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('run-oauth', (_, site) => {
  const { shell: shellUtil } = require('electron');

  mainWindow.webContents.send('download-output', {
    type: 'info',
    text: `\n🔑 Starting OAuth for ${site}...\n`,
  });

  const oauthProcess = spawn('gallery-dl', [`oauth:${site}`], {
    env: { ...process.env },
  });

  oauthProcess.stdout.on('data', (data) => {
    const text = data.toString();
    mainWindow.webContents.send('download-output', { type: 'stdout', text });

    // Auto-open any https:// URLs that gallery-dl prints (the auth URL)
    const urlMatch = text.match(/https?:\/\/[^\s"']+/g);
    if (urlMatch) {
      urlMatch.forEach(url => {
        // Only open Reddit/OAuth authorization URLs, not callback URLs
        if (url.includes('reddit.com') || url.includes('oauth') || url.includes('authorize')) {
          shellUtil.openExternal(url);
          mainWindow.webContents.send('download-output', {
            type: 'info',
            text: `\n↗ Opened in browser: ${url}\n`,
          });
        }
      });
    }
  });

  oauthProcess.stderr.on('data', (data) => {
    mainWindow.webContents.send('download-output', { type: 'stderr', text: data.toString() });
  });

  oauthProcess.on('close', (code) => {
    mainWindow.webContents.send('download-output', {
      type: code === 0 ? 'success' : 'stderr',
      text: code === 0
        ? `\n✓ OAuth complete for ${site}. Copy the tokens shown above into your gallery-dl config file.\n`
        : `\nOAuth process exited with code ${code}\n`,
    });
  });

  oauthProcess.on('error', (err) => {
    mainWindow.webContents.send('download-output', {
      type: 'error',
      text: `\n✗ Failed to run gallery-dl oauth:${site} — ${err.message}\n`,
    });
  });
});

ipcMain.handle('minimize-window', () => mainWindow.minimize());
ipcMain.handle('maximize-window', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.handle('close-window', () => mainWindow.close());
