// Toolbar icon toggles the extension on/off. State is kept in
// chrome.storage.sync so it persists and syncs across machines.

async function getEnabled() {
  const { enabled = true } = await chrome.storage.sync.get('enabled');
  return enabled;
}

async function updateBadge(enabled) {
  await chrome.action.setBadgeText({ text: enabled ? '' : 'OFF' });
  await chrome.action.setBadgeBackgroundColor({ color: '#8b949e' });
}

chrome.action.onClicked.addListener(async () => {
  const enabled = !(await getEnabled());
  await chrome.storage.sync.set({ enabled });
  await updateBadge(enabled);
});

chrome.runtime.onInstalled.addListener(async () => updateBadge(await getEnabled()));
chrome.runtime.onStartup.addListener(async () => updateBadge(await getEnabled()));
