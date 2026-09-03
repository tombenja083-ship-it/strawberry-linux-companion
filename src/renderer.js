const webview = document.getElementById('webview');
const address = document.getElementById('address');
const pageStatus = document.getElementById('page-status');
const chat = document.getElementById('chat');
const prompt = document.getElementById('prompt');
const chatForm = document.getElementById('chat-form');
const sendButton = document.getElementById('send-button');
const providerLabel = document.getElementById('provider-label');
const settingsDialog = document.getElementById('settings-dialog');
const settingsForm = document.getElementById('settings-form');
const googleCard = document.getElementById('google-card');
const googleAccount = document.getElementById('google-account');
const googleContent = document.getElementById('google-content');
const skillsDialog = document.getElementById('skills-dialog');
const skillDraft = document.getElementById('skill-draft');
const skillStatus = document.getElementById('skill-status');
const skillLibrary = document.getElementById('skill-library');
let messages = [];
let lastGoogleOverview = null;

function addMessage(role, content, kind = '') {
  const node = document.createElement('div');
  node.className = `message ${role} ${kind}`.trim();
  node.textContent = content;
  chat.appendChild(node);
  chat.scrollTop = chat.scrollHeight;
}

function normalizeUrl(value) {
  const text = value.trim();
  if (!text) return 'https://www.google.com';
  if (/^https?:\/\//i.test(text)) return text;
  if (text.includes(' ') || !text.includes('.')) return `https://www.google.com/search?q=${encodeURIComponent(text)}`;
  return `https://${text}`;
}

function updateAddress(url) {
  if (url) address.value = url;
}

async function currentPageText() {
  if (!document.getElementById('page-context').checked) return '';
  try {
    return await webview.executeJavaScript(`document.body ? document.body.innerText.slice(0, 14000) : ''`, true);
  } catch {
    return '';
  }
}

async function skillPageText() {
  try {
    return await webview.executeJavaScript(`document.body ? document.body.innerText.slice(0, 18000) : ''`, true);
  } catch {
    return '';
  }
}

function stripCodeFence(text) {
  const value = String(text || '').trim();
  return value.replace(/^```(?:markdown)?\s*/i, '').replace(/\s*```$/, '').trim();
}

async function loadSkillLibrary() {
  const skills = await window.strawberry.listSkills();
  skillLibrary.replaceChildren();
  if (!skills.length) {
    const empty = document.createElement('div');
    empty.className = 'skill-empty';
    empty.textContent = 'No approved skills yet.';
    skillLibrary.appendChild(empty);
    return;
  }
  skills.forEach((skill) => {
    const row = document.createElement('div');
    row.className = 'skill-row';
    const name = document.createElement('strong');
    name.textContent = skill.name;
    const description = document.createElement('span');
    description.textContent = skill.description;
    row.append(name, description);
    skillLibrary.appendChild(row);
  });
}

async function learnSkillFromPage() {
  const topic = document.getElementById('skill-topic').value.trim();
  if (!topic) {
    skillStatus.textContent = 'Describe what you want the skill to teach.';
    return;
  }
  const pageContext = await skillPageText();
  if (!pageContext) {
    skillStatus.textContent = 'The current page has no readable text. Open a public guide or documentation page first.';
    return;
  }
  skillStatus.textContent = 'Drafting a skill from the current page…';
  const result = await window.strawberry.draftSkill({ topic, pageContext });
  if (result.ok) {
    skillDraft.value = stripCodeFence(result.draft);
    skillStatus.textContent = 'Draft ready. Review it carefully before approving and saving.';
  } else skillStatus.textContent = result.error;
}

function googleContextText() {
  if (!document.getElementById('google-context').checked || !lastGoogleOverview?.connected) return '';
  return JSON.stringify(lastGoogleOverview);
}

async function skillContextText() {
  if (!document.getElementById('skills-context').checked) return '';
  const skills = await window.strawberry.listSkills();
  if (!skills.length) return '';
  const full = await Promise.all(skills.slice(0, 8).map((skill) => window.strawberry.getSkill(skill.name)));
  return full.filter(Boolean).map((skill) => skill.content).join('\n\n').slice(0, 18000);
}

function formatEventDate(event) {
  const value = event.start?.dateTime || event.start?.date;
  if (!value) return '';
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: event.start?.dateTime ? 'short' : undefined });
}

function appendGoogleGroup(title, items, emptyText, renderItem) {
  const group = document.createElement('div');
  group.className = 'google-group';
  const heading = document.createElement('strong');
  heading.textContent = title;
  group.appendChild(heading);
  if (!items?.length) {
    const empty = document.createElement('div');
    empty.className = 'google-empty';
    empty.textContent = emptyText;
    group.appendChild(empty);
  } else {
    items.forEach((item) => {
      const node = document.createElement('div');
      node.className = 'google-item';
      renderItem(node, item);
      group.appendChild(node);
    });
  }
  googleContent.appendChild(group);
}

function renderGoogleOverview(overview) {
  lastGoogleOverview = overview;
  googleCard.hidden = false;
  googleContent.replaceChildren();
  if (!overview?.connected) {
    googleAccount.textContent = 'Not connected';
    const empty = document.createElement('div');
    empty.className = 'google-empty';
    empty.textContent = 'Open Settings to connect Gmail, Drive, and Calendar.';
    googleContent.appendChild(empty);
    return;
  }
  googleAccount.textContent = overview.user?.email || 'Connected Google account';
  appendGoogleGroup('Unread Gmail', overview.gmail?.unread, overview.gmail?.error || 'No unread messages found.', (node, item) => {
    node.textContent = `${item.subject || '(no subject)'}\n${item.from || ''}\n${item.snippet || ''}`;
  });
  appendGoogleGroup('Recent Drive files', overview.drive?.files, overview.drive?.error || 'No recent files found.', (node, item) => {
    node.textContent = `${item.name || '(unnamed file)'}\n${item.modifiedTime ? new Date(item.modifiedTime).toLocaleString() : ''}`;
  });
  appendGoogleGroup('Upcoming Calendar', overview.calendar?.events, overview.calendar?.error || 'No upcoming events found.', (node, item) => {
    node.textContent = `${item.summary || '(untitled event)'}\n${formatEventDate(item)}${item.location ? ` · ${item.location}` : ''}`;
  });
}

async function refreshGoogleOverview() {
  googleContent.replaceChildren();
  const loading = document.createElement('div');
  loading.className = 'google-empty';
  loading.textContent = 'Loading Google data…';
  googleContent.appendChild(loading);
  googleCard.hidden = false;
  const result = await window.strawberry.googleOverview();
  if (result.ok) renderGoogleOverview(result.overview);
  else {
    lastGoogleOverview = null;
    googleAccount.textContent = 'Unavailable';
    googleContent.replaceChildren();
    const error = document.createElement('div');
    error.className = 'google-empty';
    error.textContent = result.error;
    googleContent.appendChild(error);
  }
}

async function submitPrompt() {
  const text = prompt.value.trim();
  if (!text || sendButton.disabled) return;
  prompt.value = '';
  addMessage('user', text);
  messages.push({ role: 'user', content: text });
  sendButton.disabled = true;
  sendButton.textContent = 'Thinking…';
  const pageContext = await currentPageText();
  const skillContext = await skillContextText();
  const result = await window.strawberry.askAI({ messages, pageContext, googleContext: googleContextText(), skillContext });
  if (result.ok) {
    addMessage('assistant', result.answer);
    messages.push({ role: 'assistant', content: result.answer });
  } else {
    addMessage('assistant', result.error, 'error');
  }
  sendButton.disabled = false;
  sendButton.textContent = 'Send';
  prompt.focus();
}

function fillSettings(config, googleState) {
  document.getElementById('provider').value = config.provider || 'openai-compatible';
  document.getElementById('endpoint').value = config.endpoint || '';
  document.getElementById('model').value = config.model || '';
  document.getElementById('api-key').value = config.apiKey || '';
  document.getElementById('temperature').value = config.temperature ?? 0.3;
  document.getElementById('google-client-id').value = config.googleClientId || '';
  document.getElementById('google-status').textContent = googleState?.connected ? 'Connected' : 'Not connected';
  document.getElementById('disconnect-google').disabled = !googleState?.connected;
  providerLabel.textContent = config.provider === 'demo' ? 'Demo mode' : `${config.provider} · ${config.model}`;
}

webview.addEventListener('did-start-loading', () => { pageStatus.textContent = 'Loading…'; });
webview.addEventListener('did-stop-loading', () => { pageStatus.textContent = 'Ready'; updateAddress(webview.getURL()); });
webview.addEventListener('did-navigate', (event) => updateAddress(event.url));
webview.addEventListener('did-navigate-in-page', (event) => updateAddress(event.url));

document.getElementById('address-form').addEventListener('submit', (event) => {
  event.preventDefault();
  webview.loadURL(normalizeUrl(address.value));
});
document.getElementById('back-button').addEventListener('click', () => { if (webview.canGoBack()) webview.goBack(); });
document.getElementById('forward-button').addEventListener('click', () => { if (webview.canGoForward()) webview.goForward(); });
chatForm.addEventListener('submit', (event) => { event.preventDefault(); submitPrompt(); });
prompt.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitPrompt(); }
});
document.getElementById('clear-chat').addEventListener('click', () => {
  messages = [];
  chat.innerHTML = '';
  addMessage('assistant', 'Chat cleared. What would you like to explore?');
});
document.getElementById('skills-button').addEventListener('click', async () => {
  skillStatus.textContent = '';
  document.getElementById('skill-source').textContent = `Source: ${webview.getURL() || 'current browser page'}`;
  skillsDialog.showModal();
  await loadSkillLibrary();
});
document.getElementById('refresh-skills').addEventListener('click', loadSkillLibrary);
document.getElementById('draft-skill').addEventListener('click', learnSkillFromPage);
document.getElementById('save-skill').addEventListener('click', async () => {
  const content = skillDraft.value.trim();
  if (!content) {
    skillStatus.textContent = 'Draft a skill first, then review it before saving.';
    return;
  }
  skillStatus.textContent = 'Saving approved skill…';
  const result = await window.strawberry.saveSkill({ content, sourceUrl: webview.getURL() });
  if (result.ok) {
    skillStatus.textContent = `Saved ${result.skill.name} to the local skill library.`;
    await loadSkillLibrary();
  } else skillStatus.textContent = result.error;
});
document.getElementById('settings-button').addEventListener('click', async () => {
  fillSettings(await window.strawberry.getConfig(), await window.strawberry.googleStatus());
  settingsDialog.showModal();
});
document.getElementById('google-button').addEventListener('click', refreshGoogleOverview);
document.getElementById('refresh-google').addEventListener('click', refreshGoogleOverview);
document.getElementById('connect-google').addEventListener('click', async () => {
  const config = await window.strawberry.saveConfig({ googleClientId: document.getElementById('google-client-id').value.trim() });
  document.getElementById('google-client-id').value = config.googleClientId || '';
  const status = document.getElementById('google-status');
  status.textContent = 'Opening Google sign-in…';
  const result = await window.strawberry.googleConnect();
  if (result.ok) {
    status.textContent = 'Connected';
    document.getElementById('disconnect-google').disabled = false;
    await refreshGoogleOverview();
  } else status.textContent = result.error;
});
document.getElementById('disconnect-google').addEventListener('click', async () => {
  await window.strawberry.googleDisconnect();
  document.getElementById('google-status').textContent = 'Not connected';
  document.getElementById('disconnect-google').disabled = true;
  lastGoogleOverview = null;
  googleCard.hidden = true;
});
settingsForm.addEventListener('submit', async (event) => {
  if (event.submitter?.value !== 'default') return;
  event.preventDefault();
  const config = await window.strawberry.saveConfig({
    provider: document.getElementById('provider').value,
    endpoint: document.getElementById('endpoint').value.trim(),
    model: document.getElementById('model').value.trim(),
    apiKey: document.getElementById('api-key').value,
    temperature: Number(document.getElementById('temperature').value),
    googleClientId: document.getElementById('google-client-id').value.trim()
  });
  fillSettings(config, await window.strawberry.googleStatus());
  settingsDialog.close();
});
document.getElementById('provider').addEventListener('change', (event) => {
  if (event.target.value === 'ollama') {
    document.getElementById('endpoint').value = 'http://127.0.0.1:11434/v1/chat/completions';
    document.getElementById('model').value = 'llama3.2';
    document.getElementById('api-key').value = 'ollama';
  }
  if (event.target.value === 'demo') document.getElementById('api-key').value = '';
});

(async () => {
  const config = await window.strawberry.getConfig();
  fillSettings(config, await window.strawberry.googleStatus());
  addMessage('assistant', 'Hello. I can browse with you, use the current page as context, summarize research, and help draft your next step. Open Settings to connect an AI provider or Google.');
})();
