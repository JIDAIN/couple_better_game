const R10_WECHAT = Object.freeze({
  SEND_URL: 'https://www.pushplus.plus/send',
  CLAIM_PATH: '/api/drive-bridge/reminders',
  EXPIRY_MS: 10 * 60 * 1000,
  MAX_ERROR_LENGTH: 800,
});

function r10PushPlusToken_() {
  return (r10Props_().getProperty('PUSHPLUS_TOKEN') || '').trim();
}

function r10AcceptedDeliveryKey_(deliveryId) {
  return 'WECHAT_ACCEPTED_' + deliveryId;
}

function r10ProviderMessageId_(data) {
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object' && typeof data.shortCode === 'string') return data.shortCode;
  return '';
}

function r10SendWechat_(message) {
  const token = r10PushPlusToken_();
  if (!token) throw new Error('Missing Script Property: PUSHPLUS_TOKEN');
  const response = UrlFetchApp.fetch(R10_WECHAT.SEND_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      token: token,
      title: String(message.title || ''),
      content: String(message.content || ''),
      template: 'txt',
      channel: 'wechat',
      timestamp: Date.now() + R10_WECHAT.EXPIRY_MS,
    }),
    muteHttpExceptions: true,
  });
  const httpStatus = response.getResponseCode();
  let parsed = {};
  try { parsed = JSON.parse(response.getContentText() || '{}'); } catch (error) {}
  const accepted = httpStatus >= 200 && httpStatus < 300 && Number(parsed.code) === 200;
  const providerMessageId = r10ProviderMessageId_(parsed.data);
  const errorText = accepted
    ? ''
    : ('PushPlus HTTP ' + httpStatus + ' code=' + String(parsed.code || '') + ' ' + String(parsed.msg || response.getContentText() || '')).slice(0, R10_WECHAT.MAX_ERROR_LENGTH);
  return {
    accepted: accepted,
    providerMessageId: providerMessageId,
    error: errorText,
  };
}

function r10CompleteWechat_(deliveryId, accepted, providerMessageId, errorText) {
  return r10Post_(R10_WECHAT.CLAIM_PATH, {
    action: 'complete',
    deliveryId: deliveryId,
    accepted: accepted === true,
    providerMessageId: providerMessageId || '',
    error: errorText || '',
  });
}

function processWechatReminders() {
  const token = r10PushPlusToken_();
  if (!token) return { ok: true, skipped: 'pushplus_not_configured', bridgeId: r10BridgeId_() };

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { ok: false, skipped: 'locked' };
  try {
    const response = r10Post_(R10_WECHAT.CLAIM_PATH, { action: 'claim' });
    const reminders = Array.isArray(response.reminders) ? response.reminders : [];
    const results = [];

    reminders.forEach(function (reminder) {
      const deliveryId = reminder && reminder.deliveryId ? String(reminder.deliveryId) : '';
      const message = reminder && reminder.message ? reminder.message : {};
      if (!deliveryId || !message.title || !message.content) return;

      const acceptedKey = r10AcceptedDeliveryKey_(deliveryId);
      const previouslyAccepted = r10Props_().getProperty(acceptedKey);
      if (previouslyAccepted != null) {
        try {
          r10CompleteWechat_(deliveryId, true, previouslyAccepted === 'accepted' ? '' : previouslyAccepted, '');
          r10Props_().deleteProperty(acceptedKey);
          results.push({ deliveryId: deliveryId, accepted: true, recoveredCompletion: true });
        } catch (error) {
          results.push({ deliveryId: deliveryId, accepted: true, completionPending: true });
        }
        return;
      }

      let sendResult;
      try {
        sendResult = r10SendWechat_(message);
      } catch (error) {
        sendResult = {
          accepted: false,
          providerMessageId: '',
          error: String(error && error.message ? error.message : error).slice(0, R10_WECHAT.MAX_ERROR_LENGTH),
        };
      }

      if (sendResult.accepted) {
        r10Props_().setProperty(acceptedKey, sendResult.providerMessageId || 'accepted');
      }

      try {
        r10CompleteWechat_(
          deliveryId,
          sendResult.accepted,
          sendResult.providerMessageId,
          sendResult.error
        );
        if (sendResult.accepted) r10Props_().deleteProperty(acceptedKey);
        results.push({ deliveryId: deliveryId, accepted: sendResult.accepted });
      } catch (error) {
        results.push({
          deliveryId: deliveryId,
          accepted: sendResult.accepted,
          completionPending: sendResult.accepted,
          error: String(error && error.message ? error.message : error).slice(0, R10_WECHAT.MAX_ERROR_LENGTH),
        });
      }
    });

    r10WriteMeta_('last_wechat_reminder_check_at', new Date().toISOString());
    return { ok: true, bridgeId: r10BridgeId_(), claimed: reminders.length, results: results };
  } finally {
    lock.releaseLock();
  }
}

function setupWechatReminderTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'processWechatReminders') ScriptApp.deleteTrigger(trigger);
  });

  const configured = !!r10PushPlusToken_();
  if (configured) {
    ScriptApp.newTrigger('processWechatReminders').timeBased().everyMinutes(5).create();
    processWechatReminders();
  }
  r10WriteMeta_('wechat_reminder_status', configured ? 'active' : 'pushplus_token_missing');
  return { ok: true, bridgeId: r10BridgeId_(), configured: configured };
}

// One-time setup entry point for the final R10 worker. Run this instead of setupR10Triggers().
function setupR10All() {
  const bridge = setupR10Triggers();
  const wechat = setupWechatReminderTrigger();
  return { ok: true, bridge: bridge, wechat: wechat };
}
