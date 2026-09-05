const R10_FAST_KICK = Object.freeze({
  LOCK_WAIT_MS: 250,
  VISIBILITY_WAIT_MS: 1200,
  VISIBILITY_POLL_MS: 150,
  TAIL_ROWS: 64,
});

function r10FastKickRequiredHeaders_(header) {
  const required = ['command_id', 'created_at', 'tool', 'args_json', 'user_text', 'status'];
  required.forEach(function (key) {
    if (header.map[key] == null) throw new Error('Missing COMMANDS column: ' + key);
  });
}

function r10FastKickItemFromRow_(row, rowNumber, header) {
  return {
    rowNumber: rowNumber,
    command: {
      commandId: row[header.map.command_id] || '',
      tool: row[header.map.tool] || '',
      args: r10ParseArgs_(row[header.map.args_json] || '{}'),
      userText: row[header.map.user_text] || '',
      originalDriveFileId: header.map.original_drive_file_id == null ? null : (row[header.map.original_drive_file_id] || null),
    },
    status: String(row[header.map.status] || '').toLowerCase(),
  };
}

function r10FastKickFindCommand_(sheet, header, commandId) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;

  const width = Math.max(1, sheet.getLastColumn());
  const tailCount = Math.min(R10_FAST_KICK.TAIL_ROWS, lastRow - 1);
  const startRow = lastRow - tailCount + 1;
  const tail = sheet.getRange(startRow, 1, tailCount, width).getDisplayValues();

  for (let index = tail.length - 1; index >= 0; index -= 1) {
    const row = tail[index];
    if ((row[header.map.command_id] || '') === commandId) {
      return r10FastKickItemFromRow_(row, startRow + index, header);
    }
  }

  const commandColumn = header.map.command_id + 1;
  const match = sheet
    .getRange(2, commandColumn, lastRow - 1, 1)
    .createTextFinder(commandId)
    .matchEntireCell(true)
    .findNext();
  if (!match) return null;

  const rowNumber = match.getRow();
  const row = sheet.getRange(rowNumber, 1, 1, width).getDisplayValues()[0];
  return r10FastKickItemFromRow_(row, rowNumber, header);
}

function r10FastKickWaitForCommand_(sheet, header, commandId) {
  const startedAt = Date.now();
  let item = r10FastKickFindCommand_(sheet, header, commandId);
  while (!item && Date.now() - startedAt < R10_FAST_KICK.VISIBILITY_WAIT_MS) {
    Utilities.sleep(R10_FAST_KICK.VISIBILITY_POLL_MS);
    item = r10FastKickFindCommand_(sheet, header, commandId);
  }
  return item;
}

function r10FastKickWriteResult_(sheet, header, item, receipt) {
  r10AppendReceipt_(receipt);
  const status = receipt.ok
    ? 'succeeded'
    : (receipt.error === 'COMMAND_ALREADY_PROCESSING' ? 'processing' : 'failed');
  sheet.getRange(item.rowNumber, header.map.status + 1).setValue(status);
  if (header.map.processed_at != null) {
    sheet.getRange(item.rowNumber, header.map.processed_at + 1).setValue(receipt.finishedAt || new Date().toISOString());
  }
  if (header.map.error != null) {
    sheet.getRange(item.rowNumber, header.map.error + 1).setValue(receipt.error || '');
  }
}

function processCommandByIdFast_(commandId) {
  const id = String(commandId || '').trim();
  if (!id) return { ok: false, error: 'commandId is required' };

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(R10_FAST_KICK.LOCK_WAIT_MS)) {
    return { ok: false, skipped: 'locked', targeted: true };
  }

  let result;
  let shouldRefresh = false;
  try {
    const sheet = r10Sheet_('COMMANDS');
    const header = r10HeaderMap_(sheet);
    r10FastKickRequiredHeaders_(header);

    const item = r10FastKickWaitForCommand_(sheet, header, id);
    if (!item) {
      return { ok: false, skipped: 'command_not_visible', targeted: true };
    }
    if (item.status !== 'pending') {
      return {
        ok: true,
        processed: 0,
        skipped: 'not_pending',
        commandStatus: item.status || null,
        targeted: true,
      };
    }

    try {
      item.command = r10StageOriginal_(item.command);
    } catch (error) {
      const receipt = {
        commandId: item.command.commandId,
        tool: item.command.tool,
        ok: false,
        error: String(error && error.message ? error.message : error),
        finishedAt: new Date().toISOString(),
        originalDriveFileId: item.command.originalDriveFileId || '',
      };
      r10FastKickWriteResult_(sheet, header, item, receipt);
      return { ok: true, processed: 0, stagingFailed: 1, targeted: true };
    }

    const response = r10Post_('/api/drive-bridge/execute', { commands: [item.command] });
    const receipts = Array.isArray(response.receipts) ? response.receipts : [];
    const receipt = receipts.find(function (candidate) {
      return candidate && candidate.commandId === item.command.commandId;
    }) || {
      commandId: item.command.commandId,
      tool: item.command.tool,
      ok: false,
      error: 'MISSING_BRIDGE_RECEIPT',
      finishedAt: new Date().toISOString(),
    };

    r10FastKickWriteResult_(sheet, header, item, receipt);
    r10WriteMeta_('last_command_at', new Date().toISOString());
    shouldRefresh = true;
    result = { ok: true, processed: 1, stagingFailed: 0, targeted: true };
  } finally {
    lock.releaseLock();
  }

  // Snapshot is a fallback/read-model concern. Keep it outside the command lock so
  // a slow STATE_* refresh cannot block the next explicit Fast Wake.
  if (shouldRefresh) {
    try {
      refreshSnapshot();
    } catch (error) {
      console.warn('Fast Kick snapshot refresh failed', error);
    }
  }
  return result || { ok: true, processed: 0, targeted: true };
}
