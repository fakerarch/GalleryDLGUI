const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Presets
  getPresets: () => ipcRenderer.invoke('get-presets'),
  savePresets: (presets) => ipcRenderer.invoke('save-presets', presets),

  // Downloads
  startDownload: (opts) => ipcRenderer.invoke('start-download', opts),
  stopDownload: () => ipcRenderer.invoke('stop-download'),
  onOutput: (cb) => ipcRenderer.on('download-output', (_, data) => cb(data)),
  onDone: (cb) => ipcRenderer.on('download-done', (_, data) => cb(data)),
  removeOutputListeners: () => {
    ipcRenderer.removeAllListeners('download-output');
    ipcRenderer.removeAllListeners('download-done');
  },

  // Utilities
  openFolder: (p) => ipcRenderer.invoke('open-folder', p),
  getDefaultDir: () => ipcRenderer.invoke('get-default-dir'),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  pickFile: () => ipcRenderer.invoke('pick-file'),
  pickFileSave: (ext) => ipcRenderer.invoke('pick-file-save', ext),
  runOAuth: (site) => ipcRenderer.invoke('run-oauth', site),
  checkGalleryDl: () => ipcRenderer.invoke('check-gallery-dl'),
  checkFfmpeg: () => ipcRenderer.invoke('check-ffmpeg'),
  convertFiles: (dir) => ipcRenderer.invoke('convert-files', dir),
  readGdlConfig: () => ipcRenderer.invoke('read-gdl-config'),
  writeGdlConfig: (content) => ipcRenderer.invoke('write-gdl-config', content),
  patchGdlConfig: (patch) => ipcRenderer.invoke('patch-gdl-config', patch),

  // Window controls
  minimize: () => ipcRenderer.invoke('minimize-window'),
  maximize: () => ipcRenderer.invoke('maximize-window'),
  close: () => ipcRenderer.invoke('close-window'),
});
