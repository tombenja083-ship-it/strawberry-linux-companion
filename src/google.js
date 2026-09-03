const { BrowserWindow, safeStorage } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');

const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/calendar.readonly'
];
const REDIRECT_URI = 'http://127.0.0.1:47823/oauth2callback';

function tokenPath(app) {
  return path.join(app.getPath('userData'), 'google-token.json');
}

function saveToken(app, token) {
  const raw = JSON.stringify({ ...token, saved_at: Date.now() });
  const record = safeStorage.isEncryptionAvailable()
    ? { encrypted: true, value: safeStorage.encryptString(raw).toString('base64') }
    : { encrypted: false, value: raw };
  fs.mkdirSync(path.dirname(tokenPath(app)), { recursive: true });
  fs.writeFileSync(tokenPath(app), JSON.stringify(record), 'utf8');
}

function readToken(app) {
  try {
    const record = JSON.parse(fs.readFileSync(tokenPath(app), 'utf8'));
    const raw = record.encrypted
      ? safeStorage.decryptString(Buffer.from(record.value, 'base64'))
      : record.value;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearToken(app) {
  try { fs.rmSync(tokenPath(app), { force: true }); } catch { /* already disconnected */ }
}

function randomString(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

function base64Url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function createPkce() {
  const verifier = base64Url(crypto.randomBytes(48));
  const challenge = base64Url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

async function exchangeCode(clientId, code, verifier) {
  const body = new URLSearchParams({
    client_id: clientId,
    code,
    code_verifier: verifier,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Google token exchange failed (${response.status}): ${text.slice(0, 400)}`);
  const token = JSON.parse(text);
  return { ...token, expires_at: Date.now() + (Number(token.expires_in || 3600) * 1000) };
}

async function refreshToken(clientId, token) {
  if (!token?.refresh_token) return null;
  const body = new URLSearchParams({
    client_id: clientId,
    refresh_token: token.refresh_token,
    grant_type: 'refresh_token'
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!response.ok) return null;
  const next = await response.json();
  return {
    ...token,
    ...next,
    refresh_token: token.refresh_token,
    expires_at: Date.now() + (Number(next.expires_in || 3600) * 1000)
  };
}

async function getValidToken(app, clientId) {
  let token = readToken(app);
  if (!token) return null;
  if (token.expires_at && token.expires_at > Date.now() + 60000) return token;
  token = await refreshToken(clientId, token);
  if (token) saveToken(app, token);
  return token;
}

async function connectGoogle(app, clientId) {
  if (!clientId || !clientId.trim()) throw new Error('Add a Google OAuth Desktop client ID in Settings first.');
  const pkce = createPkce();
  const state = randomString(20);
  const params = new URLSearchParams({
    client_id: clientId.trim(),
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
    code_challenge: pkce.challenge,
    code_challenge_method: 'S256'
  });

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      try { server.close(); } catch { /* server may already be closed */ }
      try { authWindow?.close(); } catch { /* window may already be closed */ }
      error ? reject(error) : resolve(value);
    };

    const server = http.createServer(async (request, response) => {
      const url = new URL(request.url, REDIRECT_URI);
      if (url.pathname !== '/oauth2callback') return;
      if (url.searchParams.get('state') !== state) {
        response.end('Invalid OAuth state. You can close this window.');
        return finish(new Error('Google OAuth state validation failed.'));
      }
      const error = url.searchParams.get('error');
      if (error) {
        response.end(`Google sign-in was cancelled: ${error}. You can close this window.`);
        return finish(new Error(`Google sign-in was cancelled: ${error}`));
      }
      try {
        const token = await exchangeCode(clientId.trim(), url.searchParams.get('code'), pkce.verifier);
        saveToken(app, token);
        response.end('Google connected. You can close this window and return to Strawberry.');
        const user = await googleFetch(app, clientId.trim(), 'https://www.googleapis.com/oauth2/v2/userinfo', token);
        finish(null, { connected: true, user });
      } catch (err) {
        response.end(`Google connection failed: ${err.message}. You can close this window.`);
        finish(err);
      }
    });

    let authWindow;
    server.once('error', () => finish(new Error('Could not open the local OAuth callback port 47823. Close other copies of the app and try again.')));
    server.listen(47823, '127.0.0.1', () => {
      authWindow = new BrowserWindow({
        width: 520,
        height: 720,
        title: 'Connect Google',
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
      });
      authWindow.loadURL(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
      authWindow.on('closed', () => finish(new Error('Google sign-in window was closed before connecting.')));
    });
  });
}

async function googleFetch(app, clientId, url, tokenOverride) {
  const token = tokenOverride || await getValidToken(app, clientId);
  if (!token?.access_token) throw new Error('Google is not connected.');
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token.access_token}` } });
  const text = await response.text();
  if (response.status === 401) {
    clearToken(app);
    throw new Error('Google authorization expired. Connect Google again in Settings.');
  }
  if (!response.ok) throw new Error(`Google API error (${response.status}): ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

async function getOverview(app, clientId) {
  if (!clientId) return { connected: false, error: 'Google OAuth client ID is not configured.' };
  const token = await getValidToken(app, clientId);
  if (!token) return { connected: false };

  const now = new Date().toISOString();
  const [userResult, mailResult, driveResult, calendarResult] = await Promise.allSettled([
    googleFetch(app, clientId, 'https://www.googleapis.com/oauth2/v2/userinfo', token),
    googleFetch(app, clientId, 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=8&q=is%3Aunread%20newer_than%3A30d', token),
    googleFetch(app, clientId, 'https://www.googleapis.com/drive/v3/files?pageSize=8&orderBy=modifiedTime%20desc&q=trashed%3Dfalse&fields=files(id%2Cname%2CmimeType%2CmodifiedTime%2CwebViewLink)', token),
    googleFetch(app, clientId, `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=8&singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(now)}&fields=items(id%2Csummary%2Cdescription%2Cstart%2Cend%2Clocation%2ChtmlLink)`, token)
  ]);

  const overview = {
    connected: true,
    user: userResult.status === 'fulfilled' ? userResult.value : null,
    gmail: { unread: [], error: mailResult.status === 'rejected' ? mailResult.reason.message : null },
    drive: { files: [], error: driveResult.status === 'rejected' ? driveResult.reason.message : null },
    calendar: { events: [], error: calendarResult.status === 'rejected' ? calendarResult.reason.message : null }
  };

  if (mailResult.status === 'fulfilled') {
    const ids = mailResult.value.messages || [];
    const details = await Promise.all(ids.slice(0, 8).map(({ id }) => googleFetch(app, clientId, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, token).catch(() => null)));
    overview.gmail.unread = details.filter(Boolean).map((message) => {
      const headers = Object.fromEntries((message.payload?.headers || []).map((header) => [header.name.toLowerCase(), header.value]));
      return { id: message.id, subject: headers.subject || '(no subject)', from: headers.from || '', date: headers.date || '', snippet: message.snippet || '' };
    });
  }
  if (driveResult.status === 'fulfilled') overview.drive.files = driveResult.value.files || [];
  if (calendarResult.status === 'fulfilled') overview.calendar.events = calendarResult.value.items || [];
  return overview;
}

function status(app, clientId) {
  const token = readToken(app);
  return { connected: Boolean(token?.refresh_token || token?.access_token), hasClientId: Boolean(clientId) };
}

module.exports = { connectGoogle, clearToken, getOverview, status };
