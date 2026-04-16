# gallery-dl GUI

A cross-platform desktop GUI for [gallery-dl](https://github.com/mikf/gallery-dl), built with Electron.  
Download images and videos from hundreds of supported sites through a clean, native-feeling interface — no terminal required.

---

## Features

- **URL queue** — paste one or more URLs, queue them, run in one shot
- **Live log** — real-time stdout/stderr streamed as gallery-dl runs
- **Config presets** — named sets of CLI flags, saved to disk between sessions
- **gallery-dl config editor** — read and write `config.json` directly from the GUI
- **Output directory picker** — browse to select a destination folder, open it in your file manager
- **M4S → MP4 conversion** — automatically remux `.m4s` segments to `.mp4` after download (requires ffmpeg)
- **M4V → MP4 rename** — simple rename pass after download, no ffmpeg needed
- **OAuth helper** — launch `gallery-dl oauth:<site>` from the GUI and auto-open the authorization URL in your browser
- **Auto-detect gallery-dl** — warns you on startup (with install instructions) if gallery-dl is not in your PATH
- Runs on **Linux** and **Windows** (same codebase)

---

## Download

Pre-built releases are available on the [Releases page](https://github.com/Jeremoe0312/GalleryDLGUI/releases):

| Platform | File | Notes |
|---|---|---|
| Linux | `gallery-dl-GUI-*-linux-x64.AppImage` | Single file, no install needed — just `chmod +x` and run |
| Windows | `gallery-dl GUI Setup *.exe` | NSIS installer; offers to install gallery-dl automatically |
| Windows | `gallery-dl-GUI-*-portable.exe` | No install, runs anywhere |

> **Note:** gallery-dl itself is a separate tool and is **not bundled** with this GUI.  
> The Windows NSIS installer will offer to install it for you via `winget` or direct download.  
> See [Installing gallery-dl](#installing-gallery-dl) below.

---

## Installing gallery-dl

This GUI is a frontend — it requires `gallery-dl` to be installed and accessible on your PATH.

**Linux:**
```bash
pip install gallery-dl
# or
pipx install gallery-dl
```

**Windows:**
```powershell
# Option 1 — winget (Windows 10 1709+ / Windows 11)
winget install mikf.gallery-dl

# Option 2 — pip
pip install gallery-dl

# Option 3 — standalone .exe (no Python needed)
# Download gallery-dl.exe from https://github.com/mikf/gallery-dl/releases
# and place it next to this app, or add it to your PATH.
```

---

## Running from source

```bash
git clone https://github.com/Jeremoe0312/GalleryDLGUI.git
cd gallery-dl-gui
./setup.sh
```

`setup.sh` handles everything: installs Node.js via nvm if it's missing (no sudo required), runs `npm install`, then launches the app. It's safe to re-run — it skips steps that are already done.

To update later:

```bash
git pull
./setup.sh
```

**Manual setup** (if you already have Node.js v18+):

```bash
npm install
npm start
```

---

## Building distributables

### Linux — AppImage

Run on a Linux machine (Ubuntu 20.04+ recommended):

```bash
./build.sh
# Output: dist/gallery-dl-GUI-<version>-linux-x64.AppImage
```

### Windows — NSIS installer + portable exe

Run on a Windows machine with Node.js installed:

```bat
build.bat
REM Output: dist\gallery-dl GUI Setup <version>.exe
REM         dist\gallery-dl-GUI-<version>-portable.exe
```

### Both targets (from Linux, requires Wine for Windows cross-build)

```bash
npm run build:all
```

Output always goes to `dist/`.

---

## Usage

1. **Download tab** — paste one or more URLs (one per line), choose a preset and output folder, click **Add to Queue**, then **Start Download**
2. **Ctrl+Enter** in the URL box is a shortcut for Start Download
3. **Presets tab** — create and edit named flag sets; the first preset is the default and changes auto-save
4. **Config tab** — edit `gallery-dl`'s `config.json` directly; the file path is shown at the top
5. **M4S convert toggle** — enable before downloading to automatically remux `.m4s` segments to `.mp4` when the download finishes (requires `ffmpeg` in PATH)

---

## Project structure

```
gallery-dl-gui/
├── src/
│   ├── main.js        # Electron main process — spawns gallery-dl, handles IPC
│   ├── preload.js     # Secure IPC bridge (contextBridge / contextIsolation)
│   └── index.html     # Full UI (renderer process — HTML/CSS/JS, no framework)
├── assets/
│   ├── icon.png       # App icon — 512×512 PNG (Linux AppImage)
│   └── icon.ico       # App icon — multi-size ICO (Windows)
├── installer.nsh      # Custom NSIS script — auto-installs gallery-dl during setup
├── setup.sh           # First-time setup: installs Node.js if needed, npm install, launches app
├── build.sh           # One-step Linux AppImage build script
├── build.bat          # One-step Windows installer build script
├── package.json       # npm manifest + electron-builder config
└── .gitignore
```

---

## Data locations

| Data | Linux | Windows |
|---|---|---|
| Presets | `~/.config/gallery-dl-gui/presets.json` | `%APPDATA%\gallery-dl-gui\presets.json` |
| gallery-dl config | `~/.config/gallery-dl/config.json` | `%APPDATA%\gallery-dl\config.json` |

---

## License

MIT
