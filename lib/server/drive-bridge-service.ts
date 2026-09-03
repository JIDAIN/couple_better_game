import type { FixedLifeIdentity } from "./fixed-life-auth";
import { executeLifeAgentTool } from "./life-agent-registry";
import { compressMealPhoto, DRIVE_MEAL_PHOTO_MAX_INPUT_BYTES } from "./image-compression";
import { downloadDriveMealOriginal } from "./google-drive-service";
import { getLifeFullExport, getLifeSettings } from "./life-data-management";
import { loadHomeSyncSnapshot } from "./supabase-home-sync";
import {
  claimDriveBridgeCommand,
  driveBridgeRequestHash,
  finishDriveBridgeCommand,
} from "./drive-bridge-ledger";

type JsonRecord = Record<string, unknown>;

export type DriveBridgeCommand = {
  commandId: string;
  tool: "life_capabilities" | "life_query" | "life_mutate";
  args: JsonRecord;
  userText: string;
  originalDriveFileId?: string | null;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseCommand(value: unknown): DriveBridgeCommand {
  const row = asRecord(value);
  const commandId = stringValue(row.commandId).slice(0, 120);
  const tool = stringValue(row.tool);
  const userText = stringValue(row.userText).slice(0, 12000);
  const originalDriveFileId = stringValue(row.originalDriveFileId) || null;
  if (!commandId) throw new Error("commandId 不能为空");
  if (tool !== "life_capabilities" && tool !== "life_query" && tool !== "life_mutate") {
    throw new Error("tool 不受支持");
  }
  return { commandId, tool, args: asRecord(row.args), userText, originalDriveFileId };
}

async function buildAttachment(command: DriveBridgeCommand) {
  if (!command.originalDriveFileId) return null;
  if (command.tool !== "life_mutate") throw new Error("只有 life_mutate 可以绑定原图");
  const resource = stringValue(command.args.resource);
  if (resource !== "meal" || command.args.attachPhoto !== true) {
    throw new Error("Drive 原图只能用于 attachPhoto=true 的 meal 写入");
  }
  const original = await downloadDriveMealOriginal(command.originalDriveFileId);
  const compressed = await compressMealPhoto(original.bytes, original.mimeType, {
    maxInputBytes: DRIVE_MEAL_PHOTO_MAX_INPUT_BYTES,
  });
  return {
    bytes: compressed.bytes,
    contentType: compressed.contentType,
    extension: compressed.extension,
    width: compressed.width,
    height: compressed.height,
    outputBytes: compressed.outputBytes,
  } as const;
}

export async function executeDriveBridgeCommand(identity: FixedLifeIdentity, input: unknown) {
  const command = parseCommand(input);
  const startedAt = new Date().toISOString();
  const requestHash = driveBridgeRequestHash(command);
  const claim = await claimDriveBridgeCommand({
    commandId: command.commandId,
    actor: identity.partnerKey,
    tool: command.tool,
    requestHash,
  });

  if (!claim.claimed) {
    if (claim.row.receipt) return claim.row.receipt;
    return {
      commandId: command.commandId,
      ok: false as const,
      receivedAt: startedAt,
      finishedAt: new Date().toISOString(),
      tool: command.tool,
      error: "COMMAND_ALREADY_PROCESSING",
      originalDriveFileId: command.originalDriveFileId,
    };
  }

  try {
    const attachment = await buildAttachment(command);
    const result = await executeLifeAgentTool(command.tool, command.args, {
      identity,
      latestUserText: command.userText,
      attachment,
      toolCallId: `drive-${command.commandId}`,
    });
    const receipt = {
      commandId: command.commandId,
      ok: true as const,
      receivedAt: startedAt,
      finishedAt: new Date().toISOString(),
      tool: command.tool,
      result,
      originalDriveFileId: command.originalDriveFileId,
    };
    await finishDriveBridgeCommand(command.commandId, "succeeded", receipt);
    return receipt;
  } catch (error) {
    const receipt = {
      commandId: command.commandId,
      ok: false as const,
      receivedAt: startedAt,
      finishedAt: new Date().toISOString(),
      tool: command.tool,
      error: error instanceof Error ? error.message : "Drive Bridge 执行失败",
      originalDriveFileId: command.originalDriveFileId,
    };
    await finishDriveBridgeCommand(command.commandId, "failed", receipt);
    return receipt;
  }
}

export async function executeDriveBridgeBatch(identity: FixedLifeIdentity, value: unknown) {
  const body = asRecord(value);
  const commands = Array.isArray(body.commands) ? body.commands.slice(0, 25) : [];
  if (commands.length === 0) throw new Error("commands 不能为空");
  const receipts = [];
  for (const command of commands) {
    receipts.push(await executeDriveBridgeCommand(identity, command));
  }
  return receipts;
}

export async function getDriveBridgeSnapshot(identity: FixedLifeIdentity, includeLegacy = false) {
  const [lifeExport, settings, legacyHome] = await Promise.all([
    getLifeFullExport(),
    getLifeSettings(),
    includeLegacy ? loadHomeSyncSnapshot() : Promise.resolve(null),
  ]);
  return {
    schemaVersion: "r10-v1",
    generatedAt: new Date().toISOString(),
    identity: { me: identity.partnerKey, displayName: identity.displayName },
    lifeExport,
    settings,
    legacyHome,
  };
}
