// One-time Harbor worker pairing. Run only after this bound Apps Script project
// has been deployed as a Web App. Long-lived credentials are returned over HTTPS
// and stored only in Script Properties; the one-time Sheet pairing code is then cleared.

function r10PairingMetaSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Open this script from the Harbor Bridge Sheet via Extensions > Apps Script.');
  const sheet = spreadsheet.getSheetByName('META');
  if (!sheet) throw new Error('Missing META sheet');
  return { spreadsheet: spreadsheet, sheet: sheet };
}

function r10PairingMetaValue_(sheet, key) {
  const rows = sheet.getDataRange().getDisplayValues();
  for (let i = 1; i < rows.length; i += 1) {
    if (rows[i][0] === key) return String(rows[i][1] || '').trim();
  }
  return '';
}

function r10PairingSetMeta_(sheet, key, value) {
  const rows = sheet.getDataRange().getDisplayValues();
  for (let i = 1; i < rows.length; i += 1) {
    if (rows[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

function setupR10Pairing() {
  const meta = r10PairingMetaSheet_();
  const bridgeId = r10PairingMetaValue_(meta.sheet, 'bridge_id');
  const pairingCode = r10PairingMetaValue_(meta.sheet, 'pairing_code');
  const sheetId = meta.spreadsheet.getId();
  const expectedSheetId = r10PairingMetaValue_(meta.sheet, 'bridge_sheet_id');

  if (bridgeId !== 'cat' && bridgeId !== 'fish') throw new Error('META bridge_id must be cat or fish');
  if (!pairingCode) throw new Error('META pairing_code is missing or already consumed');
  if (expectedSheetId && expectedSheetId !== sheetId) throw new Error('This Apps Script is bound to the wrong Harbor Bridge Sheet');

  const webAppUrl = ScriptApp.getService().getUrl();
  if (!webAppUrl) {
    throw new Error('Deploy this Apps Script as a Web App first, then run setupR10Pairing() again.');
  }

  const response = UrlFetchApp.fetch(R10.PROGRAM_URL + '/api/drive-bridge/bootstrap', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      bridgeId: bridgeId,
      pairingCode: pairingCode,
      sheetId: sheetId,
      webAppUrl: webAppUrl,
    }),
    muteHttpExceptions: true,
  });
  const status = response.getResponseCode();
  let parsed = {};
  try { parsed = JSON.parse(response.getContentText() || '{}'); } catch (error) {}
  if (status < 200 || status >= 300 || parsed.ok !== true || !parsed.config) {
    throw new Error('Worker pairing failed HTTP ' + status + ': ' + response.getContentText().slice(0, 500));
  }

  const config = parsed.config;
  if (config.bridgeId !== bridgeId || config.actor !== bridgeId || config.sheetId !== sheetId) {
    throw new Error('Worker pairing identity mismatch');
  }
  if (!config.bridgeSecret || !config.watchToken || !config.wakeSecret || !config.originalsMealsFolderId) {
    throw new Error('Worker pairing returned incomplete credentials');
  }

  PropertiesService.getScriptProperties().setProperties({
    BRIDGE_ID: bridgeId,
    SHEET_ID: sheetId,
    BRIDGE_SECRET: String(config.bridgeSecret),
    WATCH_TOKEN: String(config.watchToken),
    WAKE_SECRET: String(config.wakeSecret),
    ORIGINALS_MEALS_FOLDER_ID: String(config.originalsMealsFolderId),
    BACKUP_LEADER: config.backupLeader === true ? 'true' : 'false',
  });

  // Remove the one-time bootstrap credential immediately after successful consumption.
  r10PairingSetMeta_(meta.sheet, 'pairing_code', '');
  r10PairingSetMeta_(meta.sheet, 'pairing_status', 'paired');
  r10PairingSetMeta_(meta.sheet, 'apps_script_url', String(config.webAppUrl || webAppUrl));
  r10PairingSetMeta_(meta.sheet, 'paired_at', String(config.pairedAt || new Date().toISOString()));

  const result = setupR10All();
  return {
    ok: true,
    bridgeId: bridgeId,
    webAppUrl: webAppUrl,
    setup: result,
  };
}
