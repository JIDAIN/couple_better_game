const R10 = Object.freeze({
  SHEET_ID: '1inEL4mXOQ2-w5UrkqtLoK6aU2o-4auCQSLlEGuA3cVo',
  PROGRAM_URL: 'https://couple-better-game.vercel.app',
  DAILY_BACKUP_FOLDER_ID: '1DmBM6Pfo7fUlhXnOpDwr8eingWiJCkpK',
  MONTHLY_BACKUP_FOLDER_ID: '1qU5floe7ORg-KbfAPR9h55TmijgSfjGP',
  MAX_COMMANDS_PER_RUN: 25,
  WATCH_TTL_MS: 23 * 60 * 60 * 1000,
  WATCH_RENEW_MARGIN_MS: 2 * 60 * 60 * 1000,
});

function r10Props_() {
  return PropertiesService.getScriptProperties();
}

function r10Secret_(name) {
  const value = r10Props_().getProperty(name);
  if (!value) throw new Error('Missing Script Property: ' + name);
  return value;
}

function r10Uuid_() {
  return Utilities.getUuid();
}

function r10Hex_(bytes) {
  return bytes.map(function (b) {
    const value = b < 0 ? b + 256 : b;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function r10Sign_(rawBody) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const digest = r10Hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, rawBody, Utilities.Charset.UTF_8));
  const mac = Utilities.computeHmacSha256Signature(timestamp + '.' + digest, r10Secret_('BRIDGE_SECRET'), Utilities.Charset.UTF_8);
  const signature = Utilities.base64EncodeWebSafe(mac).replace(/=+$/, '');
  return { timestamp: timestamp, signature: signature };
}

function r10Post_(path, payload) {
  const rawBody = JSON.stringify(payload || {});
  const signed = r10Sign_(rawBody);
  const response = UrlFetchApp.fetch(R10.PROGRAM_URL + path, {
    method: 'post',
    contentType: 'application/json',
    payload: rawBody,
    muteHttpExceptions: true,
    headers: {
      'x-life-bridge-timestamp': signed.timestamp,
      'x-life-bridge-signature': signed.signature,
    },
  });
  const status = response.getResponseCode();
  let parsed = null;
  try { parsed = JSON.parse(response.getContentText() || '{}'); } catch (error) {}
  if (status < 200 || status >= 300) {
    throw new Error('Bridge HTTP ' + status + ': ' + response.getContentText().slice(0, 500));
  }
  return parsed || {};
}

function r10Sheet_(name) {
  const sheet = SpreadsheetApp.openById(R10.SHEET_ID).getSheetByName(name);
  if (!sheet) throw new Error('Missing sheet: ' + name);
  return sheet;
}

function r10HeaderMap_(sheet) {
  const lastColumn = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const map = {};
  headers.forEach(function (header, index) { if (header) map[header] = index; });
  return { headers: headers, map: map };
}

function r10WriteMeta_(key, value) {
  const sheet = r10Sheet_('META');
  const rows = sheet.getDataRange().getDisplayValues();
  for (let i = 1; i < rows.length; i += 1) {
    if (rows[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

function r10ParseArgs_(value) {
  if (!value) return {};
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('args_json must be object');
  return parsed;
}

function r10AppendReceipt_(receipt) {
  const sheet = r10Sheet_('RECEIPTS');
  const result = receipt.result || {};
  const mealId = result && typeof result === 'object' && result.id ? result.id : '';
  const photoPath = result && typeof result === 'object' && result.photoPath ? result.photoPath : '';
  sheet.appendRow([
    receipt.commandId || '',
    receipt.receivedAt || '',
    receipt.finishedAt || '',
    receipt.tool || '',
    receipt.ok === true,
    receipt.result ? JSON.stringify(receipt.result) : '',
    receipt.error || '',
    receipt.originalDriveFileId ? (receipt.ok ? 'compressed_and_bound' : 'failed') : '',
    mealId,
    receipt.originalDriveFileId || '',
    photoPath,
  ]);
}

function processPendingCommands() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { ok: false, skipped: 'locked' };
  try {
    const sheet = r10Sheet_('COMMANDS');
    const values = sheet.getDataRange().getDisplayValues();
    if (values.length <= 1) return { ok: true, processed: 0 };
    const header = r10HeaderMap_(sheet);
    const required = ['command_id', 'created_at', 'tool', 'args_json', 'user_text', 'status'];
    required.forEach(function (key) { if (header.map[key] == null) throw new Error('Missing COMMANDS column: ' + key); });

    const pending = [];
    for (let i = 1; i < values.length && pending.length < R10.MAX_COMMANDS_PER_RUN; i += 1) {
      const row = values[i];
      if ((row[header.map.status] || '').toLowerCase() !== 'pending') continue;
      const commandId = row[header.map.command_id] || '';
      if (!commandId) continue;
      pending.push({
        rowNumber: i + 1,
        command: {
          commandId: commandId,
          tool: row[header.map.tool] || '',
          args: r10ParseArgs_(row[header.map.args_json] || '{}'),
          userText: row[header.map.user_text] || '',
          originalDriveFileId: header.map.original_drive_file_id == null ? null : (row[header.map.original_drive_file_id] || null),
        },
      });
    }
    if (!pending.length) return { ok: true, processed: 0 };

    const response = r10Post_('/api/drive-bridge/execute', { commands: pending.map(function (item) { return item.command; }) });
    const receipts = Array.isArray(response.receipts) ? response.receipts : [];
    const byId = {};
    receipts.forEach(function (receipt) { if (receipt && receipt.commandId) byId[receipt.commandId] = receipt; });

    pending.forEach(function (item) {
      const receipt = byId[item.command.commandId] || {
        commandId: item.command.commandId,
        tool: item.command.tool,
        ok: false,
        error: 'MISSING_BRIDGE_RECEIPT',
        finishedAt: new Date().toISOString(),
      };
      r10AppendReceipt_(receipt);
      const statusColumn = header.map.status + 1;
      const processedColumn = header.map.processed_at == null ? null : header.map.processed_at + 1;
      const errorColumn = header.map.error == null ? null : header.map.error + 1;
      sheet.getRange(item.rowNumber, statusColumn).setValue(receipt.ok ? 'succeeded' : (receipt.error === 'COMMAND_ALREADY_PROCESSING' ? 'processing' : 'failed'));
      if (processedColumn) sheet.getRange(item.rowNumber, processedColumn).setValue(receipt.finishedAt || new Date().toISOString());
      if (errorColumn) sheet.getRange(item.rowNumber, errorColumn).setValue(receipt.error || '');
    });

    r10WriteMeta_('last_command_at', new Date().toISOString());
    refreshSnapshot();
    return { ok: true, processed: pending.length };
  } finally {
    lock.releaseLock();
  }
}

function r10ReplaceObjects_(sheetName, objects) {
  const sheet = r10Sheet_(sheetName);
  const header = r10HeaderMap_(sheet);
  const headers = header.headers.filter(function (value) { return value !== ''; });
  const rows = (objects || []).map(function (item) {
    return headers.map(function (key) {
      const value = item && Object.prototype.hasOwnProperty.call(item, key) ? item[key] : '';
      return value != null && typeof value === 'object' ? JSON.stringify(value) : (value == null ? '' : value);
    });
  });
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, Math.max(1, headers.length)).clearContent();
  if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function r10FlattenSettings_(settings) {
  const rows = [];
  Object.keys(settings || {}).sort().forEach(function (key) {
    const value = settings[key];
    rows.push({ key: key, value: value != null && typeof value === 'object' ? JSON.stringify(value) : value });
  });
  return rows;
}

function refreshSnapshot() {
  const response = r10Post_('/api/drive-bridge/snapshot', { includeLegacy: false });
  const snapshot = response.snapshot || {};
  const user = snapshot.lifeExport && snapshot.lifeExport.user ? snapshot.lifeExport.user : {};
  r10ReplaceObjects_('STATE_MOOD', user.mood_entries || []);
  r10ReplaceObjects_('STATE_SLEEP', user.sleep_records || []);
  r10ReplaceObjects_('STATE_ACTIVITY', user.activity_entries || []);
  r10ReplaceObjects_('STATE_MEALS', user.meals || []);
  r10ReplaceObjects_('STATE_MEAL_ITEMS', user.meal_items || []);
  r10ReplaceObjects_('STATE_WEIGHT', user.weight_measurements || []);
  r10ReplaceObjects_('STATE_MEDICINE', user.medicine_items || []);
  r10ReplaceObjects_('STATE_MAILBOX', user.mailbox_letters || []);
  r10ReplaceObjects_('STATE_PARTNERS', user.partner_profiles || []);
  r10ReplaceObjects_('STATE_SETTINGS', r10FlattenSettings_(snapshot.settings || {}));
  r10WriteMeta_('last_sync_at', snapshot.generatedAt || new Date().toISOString());
  r10WriteMeta_('bridge_status', 'active');
  return snapshot;
}

function r10UpsertJsonFile_(folderId, name, data) {
  const folder = DriveApp.getFolderById(folderId);
  const existing = folder.getFilesByName(name);
  while (existing.hasNext()) existing.next().setTrashed(true);
  return folder.createFile(name, JSON.stringify(data), MimeType.PLAIN_TEXT);
}

function createDailyBackup() {
  const response = r10Post_('/api/drive-bridge/snapshot', { includeLegacy: true });
  const snapshot = response.snapshot || {};
  const now = new Date();
  const day = Utilities.formatDate(now, 'Asia/Shanghai', 'yyyy-MM-dd');
  const month = Utilities.formatDate(now, 'Asia/Shanghai', 'yyyy-MM');
  r10UpsertJsonFile_(R10.DAILY_BACKUP_FOLDER_ID, day + '.json', snapshot);
  if (Utilities.formatDate(now, 'Asia/Shanghai', 'dd') === '01') {
    r10UpsertJsonFile_(R10.MONTHLY_BACKUP_FOLDER_ID, month + '.json', snapshot);
  }
  r10WriteMeta_('last_backup_at', new Date().toISOString());
  return { ok: true, day: day };
}

function renewDriveWatch() {
  const props = r10Props_();
  const expiresAt = Number(props.getProperty('WATCH_EXPIRES_AT') || 0);
  if (expiresAt > Date.now() + R10.WATCH_RENEW_MARGIN_MS) return { ok: true, skipped: 'still_valid' };

  const oldChannel = props.getProperty('WATCH_CHANNEL_ID');
  const oldResource = props.getProperty('WATCH_RESOURCE_ID');
  if (oldChannel && oldResource) {
    try {
      UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/channels/stop', {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ id: oldChannel, resourceId: oldResource }),
        muteHttpExceptions: true,
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      });
    } catch (error) {}
  }

  const channelId = r10Uuid_();
  const expiration = Date.now() + R10.WATCH_TTL_MS;
  const response = UrlFetchApp.fetch(
    'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(R10.SHEET_ID) + '/watch?supportsAllDrives=true',
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        id: channelId,
        type: 'web_hook',
        address: R10.PROGRAM_URL + '/api/drive-bridge/watch',
        token: r10Secret_('WATCH_TOKEN'),
        expiration: expiration,
      }),
      muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    }
  );
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('Drive watch registration failed: ' + response.getContentText().slice(0, 500));
  }
  const data = JSON.parse(response.getContentText() || '{}');
  props.setProperties({
    WATCH_CHANNEL_ID: channelId,
    WATCH_RESOURCE_ID: data.resourceId || '',
    WATCH_EXPIRES_AT: String(Number(data.expiration || expiration)),
  });
  r10WriteMeta_('last_watch_renewed_at', new Date().toISOString());
  return { ok: true, expiration: Number(data.expiration || expiration) };
}

function setupR10Triggers() {
  const handlers = ['processPendingCommands', 'renewDriveWatch', 'createDailyBackup'];
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (handlers.indexOf(trigger.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('processPendingCommands').timeBased().everyMinutes(1).create();
  ScriptApp.newTrigger('renewDriveWatch').timeBased().everyHours(6).create();
  ScriptApp.newTrigger('createDailyBackup').timeBased().atHour(4).everyDays(1).create();
  refreshSnapshot();
  createDailyBackup();
  renewDriveWatch();
  return { ok: true };
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse(e && e.postData ? e.postData.contents : '{}'); } catch (error) {}
  if (!body || body.secret !== r10Secret_('WAKE_SECRET')) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'unauthorized' })).setMimeType(ContentService.MimeType.JSON);
  }
  let result;
  try { result = processPendingCommands(); } catch (error) { result = { ok: false, error: String(error && error.message ? error.message : error) }; }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
