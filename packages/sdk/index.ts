import type { Action, Session } from "../core/types.js";

export class BrowseClient {
  constructor(
    readonly baseURL: string,
    private readonly token: string,
  ) {
    const url = new URL(baseURL);
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      )
    )
      throw Error("HTTPS_REQUIRED");
  }
  async request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    const response = await fetch(new URL(path, this.baseURL), {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      throw Error(result.error || `HTTP_${response.status}`);
    }
    return response.json() as Promise<T>;
  }
  list() {
    return this.request<Session[]>("/api/sessions");
  }
  create(
    name: string,
    platform = "browser",
    requestId: string = crypto.randomUUID(),
  ) {
    return this.request<Session>("/api/sessions", "POST", {
      name,
      platform,
      requestId,
    });
  }
  get(id: string) {
    return this.request<Session>(`/api/sessions/${encodeURIComponent(id)}`);
  }
  observe(id: string) {
    return this.request<{
      url: string;
      title: string;
      elements: { ref: string; role: string; text: string; frame: string }[];
    }>(`/api/sessions/${encodeURIComponent(id)}/observe`);
  }
  claim(id: string, epoch: number, actor?: string) {
    return this.request<Session>(
      `/api/sessions/${encodeURIComponent(id)}/control`,
      "POST",
      { epoch, actor },
    );
  }
  act(
    id: string,
    epoch: number,
    action: Action,
    requestId: string = crypto.randomUUID(),
  ) {
    return this.request<{ outcome: string; replay: boolean }>(
      `/api/sessions/${encodeURIComponent(id)}/actions`,
      "POST",
      { requestId, epoch, deadline: Date.now() + 15000, action },
    );
  }
  stop(id: string) {
    return this.request<{ ok: boolean }>(
      `/api/sessions/${encodeURIComponent(id)}`,
      "DELETE",
    );
  }
}
