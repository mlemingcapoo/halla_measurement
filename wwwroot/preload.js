const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    send: (channel, data) => {
        // console.log('Sending on channel:', channel, 'with data:', data)
        ipcRenderer.send(channel, data)
    },
    receive: (channel, func) => {
        // Wrap the function in a self-removing listener
        const listener = (event, ...args) => {
            func(...args); // Execute the provided callback
            ipcRenderer.removeListener(channel, listener); // Remove the listener after execution
        };
        ipcRenderer.on(channel, listener);
    },
    receiveOnce: (channel, func) => ipcRenderer.once(channel, (event, ...args) => func(...args)),
    closeApp: () => ipcRenderer.send('close-app'),
})
