const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
    platform: process.platform,
    version: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,

    // You can add more APIs here as needed
    // Example: File system access, notifications, etc.

    // send: (channel, data) => {
    //     // whitelist channels
    //     let validChannels = ['toMain'];
    //     if (validChannels.includes(channel)) {
    //         ipcRenderer.send(channel, data);
    //     }
    // },
    // receive: (channel, func) => {
    //     let validChannels = ['fromMain'];
    //     if (validChannels.includes(channel)) {
    //         ipcRenderer.on(channel, (event, ...args) => func(...args));
    //     }
    // }
});

console.log('[TPM Desktop] Preload script loaded');
