import { NextResponse } from "next/server";
import { buildHomeSyncData } from "../../../lib/home/export-service";
import { importHomeBackupJson } from "../../../lib/home/import-service";

export const runtime = "nodejs";

type SaveDataRequest = {
  password?: unknown;
  data?: unknown;
};

type GitHubContentResponse = {
  sha?: string;
  message?: string;
};

type SaveDataErrorCode =
  | "SERVER_CONFIG"
  | "BAD_REQUEST"
  | "WRONG_PASSWORD"
  | "INVALID_DATA"
  | "GITHUB_CONFLICT"
  | "GITHUB_READ_FAILED"
  | "GITHUB_WRITE_FAILED"
  | "GITHUB_NETWORK_ERROR";

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function githubPath(path: string) {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function jsonError(
  message: string,
  status: number,
  errorCode: SaveDataErrorCode,
) {
  return NextResponse.json({ ok: false, error: message, errorCode }, { status });
}

export async function POST(request: Request) {
  const token = env("GITHUB_TOKEN");
  const owner = env("GITHUB_REPO_OWNER");
  const repo = env("GITHUB_REPO_NAME");
  const dataFilePath = env("GITHUB_DATA_FILE_PATH") || "public/data/couple-data.json";
  const editPassword = env("DATA_EDIT_PASSWORD");

  if (!token || !owner || !repo || !editPassword) {
    return jsonError("服务端同步环境变量未配置完整", 500, "SERVER_CONFIG");
  }

  let body: SaveDataRequest;
  try {
    body = (await request.json()) as SaveDataRequest;
  } catch {
    return jsonError("请求格式不正确", 400, "BAD_REQUEST");
  }

  if (body.password !== editPassword) {
    return jsonError("同步密码不正确", 401, "WRONG_PASSWORD");
  }

  const imported = importHomeBackupJson(JSON.stringify(body.data));
  if (!imported.ok) {
    return jsonError(
      imported.reason ?? "同步数据格式不正确",
      400,
      "INVALID_DATA",
    );
  }

  const updatedAt = new Date().toISOString();
  const content = JSON.stringify(
    buildHomeSyncData(imported.state, updatedAt),
    null,
    2,
  );
  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(
    owner,
  )}/${encodeURIComponent(repo)}/contents/${githubPath(dataFilePath)}`;
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  try {
    let sha: string | undefined;
    const currentResponse = await fetch(`${apiUrl}?ref=main`, {
      headers,
      cache: "no-store",
    });
    if (currentResponse.ok) {
      const current = (await currentResponse.json()) as GitHubContentResponse;
      sha = current.sha;
    } else if (currentResponse.status !== 404) {
      const current = (await currentResponse.json().catch(() => null)) as
        | GitHubContentResponse
        | null;
      return jsonError(
        current?.message ?? "读取 GitHub 数据文件失败",
        502,
        "GITHUB_READ_FAILED",
      );
    }

    const updateResponse = await fetch(apiUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: "chore: sync couple data json",
        content: Buffer.from(content, "utf8").toString("base64"),
        branch: "main",
        sha,
      }),
    });

    if (!updateResponse.ok) {
      const result = (await updateResponse.json().catch(() => null)) as
        | GitHubContentResponse
        | null;
      if (updateResponse.status === 409) {
        return jsonError(
          result?.message ?? "GitHub 数据文件存在更新冲突",
          409,
          "GITHUB_CONFLICT",
        );
      }
      return jsonError(
        result?.message ?? "写入 GitHub 数据文件失败",
        502,
        "GITHUB_WRITE_FAILED",
      );
    }
  } catch {
    return jsonError("连接 GitHub 失败", 502, "GITHUB_NETWORK_ERROR");
  }

  return NextResponse.json({ ok: true, updatedAt });
}
