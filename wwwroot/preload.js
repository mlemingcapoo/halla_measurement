const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    send: (channel, data) => {
        console.log('Sending on channel:', channel, 'with data:', data)
        ipcRenderer.send(channel, data)
    },
    receive: (channel, func) => {
        console.log('Setting up receiver on channel:', channel)
        ipcRenderer.on(channel, (event, ...args) => {
            console.log('Received on channel:', channel, 'with args:', args)
            func(...args)
        })
    }
}) 