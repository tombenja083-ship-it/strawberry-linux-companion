const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('strawberry', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  askAI: (payload) => ipcRenderer.invoke('ask-ai', payload),
  googleStatus: () => ipcRenderer.invoke('google-status'),
  googleConnect: () => ipcRenderer.invoke('google-connect'),
  googleDisconnect: () => ipcRenderer.invoke('google-disconnect'),
  googleOverview: () => ipcRenderer.invoke('google-overview'),
  listSkills: () => ipcRenderer.invoke('list-skills'),
  getSkill: (name) => ipcRenderer.invoke('get-skill', name),
  draftSkill: (payload) => ipcRenderer.invoke('draft-skill', payload),
  saveSkill: (payload) => ipcRenderer.invoke('save-skill', payload),
  skillsRoot: () => ipcRenderer.invoke('skills-root'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  appInfo: () => ipcRenderer.invoke('app-info')
});
