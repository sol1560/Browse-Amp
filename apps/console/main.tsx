import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Action, Principal, Session } from "../../packages/core/types.js";
import { BrowseClient } from "../../packages/sdk/index.js";
import "./style.css";

type ElementInfo = { ref: string; role: string; text: string; frame: string };
type Platform = { id: string; available: boolean; detail: string };
const friendly: Record<string, string> = {
  CONTROL_LOST: "输入权已失效，请重新接管。",
  CONTROL_CONFLICT: "控制权已变化，请刷新。",
  NOT_FOUND: "会话不存在或已交给其他操作者。",
  UNAUTHORIZED: "访问凭据无效，请重新连接。",
  OUTCOME_UNKNOWN: "结果未确认。请检查画面，不要直接重复操作。",
  ORIGIN_NOT_ALLOWED: "该网站未加入服务端允许列表。",
  SESSION_NOT_READY: "会话已结束或暂时不可用。",
  UNSUPPORTED_CAPABILITY: "这个平台还未连接真实设备。",
  DESKTOP_BUSY: "这台桌面已有会话，请打开已有会话或先结束它。",
  UNKNOWN_ACTOR: "没有这个 Agent，请填写服务中已配置的名称。",
};
function App() {
  const [token, setToken] = useState("");
  const [draft, setDraft] = useState("");
  const [me, setMe] = useState<Principal>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("browser");
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [agent, setAgent] = useState("agent-1");
  const [url, setUrl] = useState("https://example.com");
  const [elements, setElements] = useState<ElementInfo[]>([]);
  const [image, setImage] = useState("");
  const [tab, setTab] = useState("sessions");
  const [text, setText] = useState("");
  const [ticket, setTicket] = useState("");
  const [now, setNow] = useState(Date.now());
  const [notice, setNotice] = useState("");
  const client = new BrowseClient(location.origin, token);
  const s = sessions.find((s) => s.id === selected);
  const live = s?.status === "ready";
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      const message = e instanceof Error ? e.message : "操作失败";
      setError(friendly[message] || message);
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    setSessions(await client.list());
  }
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setElements([]);
    setTicket("");
    setImage("");
    if (!token || !selected || !live) return;
    let stopped = false;
    let objectURL = "";
    let timer: ReturnType<typeof setTimeout>;
    const abort = new AbortController();
    const capture = async () => {
      try {
        const r = await fetch(`/api/sessions/${selected}/screenshot`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: abort.signal,
        });
        if (!r.ok) {
          if (!stopped) setImage("");
          return;
        }
        const next = URL.createObjectURL(await r.blob());
        if (stopped) {
          URL.revokeObjectURL(next);
          return;
        }
        if (objectURL) URL.revokeObjectURL(objectURL);
        objectURL = next;
        setImage(next);
      } catch {
        if (!stopped) setImage("");
      } finally {
        if (!stopped) timer = setTimeout(capture, 2000);
      }
    };
    void capture();
    return () => {
      stopped = true;
      abort.abort();
      clearTimeout(timer);
      if (objectURL) URL.revokeObjectURL(objectURL);
    };
  }, [token, selected, live]);
  async function act(action: Action) {
    if (!s || !me) return;
    const latest = await client.get(s.id);
    if (latest.actor !== me.actor) throw Error("CONTROL_LOST");
    const renewed = await client.claim(s.id, latest.epoch);
    await client.act(s.id, renewed.epoch, action);
    await refresh();
    setNotice("动作已提交；请查看目标页面结果。");
  }
  const remaining = s ? Math.max(0, Math.ceil((s.expires_at - now) / 1000)) : 0;
  return (
    <div className="shell">
      <header className="masthead">
        <div className="brand">
          <span className="mark">
            B<span>↗</span>
          </span>
          Browse-Amp <span className="version">0.1 / 本地预览</span>
        </div>
        <div className="connection">
          <span className={me ? "dot" : "dot off"} />
          {me ? `${me.user} / ${me.actor}` : "尚未连接"}
          {me && (
            <button
              type="button"
              onClick={() => {
                setMe(undefined);
                setToken("");
                setSessions([]);
                setSelected("");
              }}
            >
              断开
            </button>
          )}
        </div>
      </header>
      <aside className="sidebar">
        <p className="eyebrow">工作空间</p>
        <button
          type="button"
          className={tab === "sessions" ? "nav active" : "nav"}
          onClick={() => setTab("sessions")}
        >
          会话{" "}
          <span>{sessions.filter((x) => x.status === "ready").length}</span>
        </button>
        <button
          type="button"
          className={tab === "platforms" ? "nav active" : "nav"}
          onClick={() => setTab("platforms")}
        >
          平台能力 <span>09</span>
        </button>
        <div className="divider" />
        <div className="section-label">
          我的会话
          <button
            type="button"
            disabled={!me || busy}
            onClick={() => void run(refresh)}
          >
            刷新
          </button>
        </div>
        <div className="session-list">
          {sessions.map((item) => (
            <button
              type="button"
              key={item.id}
              className={selected === item.id ? "session selected" : "session"}
              onClick={() => {
                setSelected(item.id);
                setTab("sessions");
              }}
            >
              <span className={item.status === "ready" ? "dot" : "dot off"} />
              <div>
                <strong>{item.name}</strong>
                <small>
                  {item.platform} ·{" "}
                  {item.status === "ready" ? "运行中" : "已结束"}
                </small>
              </div>
            </button>
          ))}
          {!sessions.length && (
            <p className="subtle">创建后，会话会显示在这里。</p>
          )}
        </div>
        <footer>
          <strong>各自工作，随时接管。</strong>
          <p>独立浏览器 · 不共享 cookie</p>
          <span className="mono">开源 / 自部署</span>
        </footer>
      </aside>
      <main>
        <div className="page-title">
          <div>
            <p className="eyebrow">设备工作台</p>
            <h1>{tab === "platforms" ? "平台能力" : "设备会话"}</h1>
          </div>
          <span className="pill">{me ? "已连接真实服务" : "等待访问凭据"}</span>
        </div>
        {error && (
          <div role="alert" className="alert">
            {error}
            <button type="button" onClick={() => setError("")}>
              关闭
            </button>
          </div>
        )}
        {!me ? (
          <section className="welcome">
            <span className="index">01 / CONNECT</span>
            <h2>让 Agent 有自己的浏览器。</h2>
            <p>
              连接你自己的服务，创建隔离会话。你可以查看画面、导入授权的网站登录状态，或者随时拿回输入权。
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const c = new BrowseClient(location.origin, draft);
                  const identity = await c.request<Principal>("/api/me");
                  const list = await c.list();
                  setPlatforms(await c.request<Platform[]>("/api/platforms"));
                  setToken(draft);
                  setDraft("");
                  setMe(identity);
                  setSessions(list);
                });
              }}
            >
              <label htmlFor="token">访问凭据</label>
              <div className="inline">
                <input
                  id="token"
                  type="password"
                  autoComplete="off"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="粘贴本地生成的访问凭据"
                  required
                />
                <button type="submit" className="primary" disabled={busy}>
                  {busy ? "连接中…" : "连接服务 ↗"}
                </button>
              </div>
            </form>
            <p className="hint">
              先运行 <code>pnpm run init</code>
              。凭据只保存在当前页面内存，不写入浏览器存储。
            </p>
          </section>
        ) : tab === "platforms" ? (
          <section className="platforms">
            <p>这里显示当前服务已启用的入口；创建时还会检查设备是否能连接。</p>
            {platforms.map((platform, i) => (
              <div className="platform-row" key={platform.id}>
                <span className="mono">0{i + 1}</span>
                <strong>{platform.id}</strong>
                <span>{platform.detail}</span>
                <span className={platform.available ? "pill good" : "pill"}>
                  {platform.available ? "已启用" : "未接入"}
                </span>
              </div>
            ))}
            <p className="hint">
              Actions 仅用于相关项目开发测试，不是无限免费云电脑。E2B 与 Linux
              X11 以外的原生设备尚未完成接入。
            </p>
          </section>
        ) : (
          <>
            <form
              className="create-bar"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const created = await client.create(
                    name || "新的会话",
                    platform,
                  );
                  await refresh();
                  setSelected(created.id);
                  setName("");
                });
              }}
            >
              <label htmlFor="name">新会话</label>
              <input
                id="name"
                placeholder="例如：检查结账流程"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
              />
              <select
                aria-label="控制平台"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              >
                {platforms
                  .filter((p) => p.available)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id === "browser" ? "独立 Chromium" : "Linux 整机桌面"}
                    </option>
                  ))}
              </select>
              <button type="submit" className="primary" disabled={busy}>
                {busy ? "处理中…" : "+ 创建会话"}
              </button>
            </form>
            {!s ? (
              <section className="empty">
                <div className="empty-window">
                  <div>
                    <i />
                    <i />
                    <i />
                  </div>
                  <span>↗</span>
                </div>
                <h2>从一个独立会话开始</h2>
                <p>
                  每个 Agent 各有自己的页面与登录状态。
                  <br />
                  选择左侧会话查看画面，或创建新的浏览器。
                </p>
                <span className="hint">没有虚构设备，也没有预填任务。</span>
              </section>
            ) : (
              <section className="workbench">
                <div className="session-head">
                  <div>
                    <strong>{s.name}</strong>
                    <span className={live ? "dot" : "dot off"} />
                    <span>{live ? "运行中" : "已结束"}</span>
                  </div>
                  <div>
                    <span className="mono">
                      {s.actor} ·{" "}
                      {String(Math.floor(remaining / 60)).padStart(2, "0")}:
                      {String(remaining % 60).padStart(2, "0")}
                    </span>
                    <button
                      type="button"
                      disabled={!live || busy}
                      onClick={() =>
                        void run(async () => {
                          await client.claim(
                            s.id,
                            (await client.get(s.id)).epoch,
                          );
                          await refresh();
                          setNotice("已获得输入权，旧控制者不能继续输入。");
                        })
                      }
                    >
                      接管 / 续租
                    </button>
                    <button
                      type="button"
                      className="danger"
                      disabled={!live || busy}
                      onClick={() =>
                        void run(async () => {
                          await client.stop(s.id);
                          await refresh();
                          setImage("");
                          setElements([]);
                        })
                      }
                    >
                      结束会话
                    </button>
                  </div>
                </div>
                {me.human && (
                  <div className="input-tools">
                    <input
                      aria-label="Agent 名称"
                      value={agent}
                      onChange={(e) => setAgent(e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={!live || busy}
                      onClick={() =>
                        void run(async () => {
                          await client.claim(
                            s.id,
                            (await client.get(s.id)).epoch,
                            agent,
                          );
                          await refresh();
                          setNotice("已交给 Agent。你仍可观察画面或随时接管。");
                        })
                      }
                    >
                      交给 Agent
                    </button>
                  </div>
                )}
                <div className="panes">
                  <div className="viewport">
                    <form
                      className="address"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void run(() => act({ type: "navigate", url }));
                      }}
                    >
                      <span>↗</span>
                      <input
                        aria-label="目标网址"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                      />
                      <button
                        type="submit"
                        disabled={!live || busy || s.platform !== "browser"}
                      >
                        打开
                      </button>
                    </form>
                    <div className="screen">
                      {image && live ? (
                        <button
                          type="button"
                          className="screen-control"
                          aria-label="点击目标画面"
                          disabled={busy || s.actor !== me.actor}
                          onClick={(e) => {
                            const bounds =
                              e.currentTarget.getBoundingClientRect();
                            if (e.detail === 0) {
                              setNotice(
                                "请在画面上点选目标，或用右侧元素操作。",
                              );
                              return;
                            }
                            const x = (e.clientX - bounds.left) / bounds.width;
                            const y = (e.clientY - bounds.top) / bounds.height;
                            void run(() => act({ type: "pointer", x, y }));
                          }}
                        >
                          <img src={image} alt="目标设备实时画面" />
                        </button>
                      ) : (
                        <div className="screen-placeholder">
                          {live
                            ? "等待设备画面…"
                            : "会话已结束；原生桌面应用不会关闭。"}
                        </div>
                      )}
                    </div>
                    <div className="screen-foot">
                      <span className="dot" />每 2 秒更新画面
                      <span>按比例显示 · 点击画面操作</span>
                    </div>
                  </div>
                  <aside className="inspector">
                    <div className="section-label">
                      页面元素
                      <button
                        type="button"
                        disabled={!live || busy}
                        onClick={() =>
                          void run(async () => {
                            setElements((await client.observe(s.id)).elements);
                          })
                        }
                      >
                        读取
                      </button>
                    </div>
                    <p className="hint">
                      读取后选择元素操作。导航或再次读取会使旧编号失效。
                    </p>
                    <label htmlFor="input-text">要填写的文字</label>
                    <input
                      id="input-text"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="先填写，再选择目标"
                    />
                    <div className="input-tools">
                      <button
                        type="button"
                        disabled={!live || busy}
                        onClick={() =>
                          void run(() => act({ type: "type", text }))
                        }
                      >
                        发送文字
                      </button>
                      <button
                        type="button"
                        disabled={!live || busy}
                        onClick={() =>
                          void run(() => act({ type: "press", key: "Enter" }))
                        }
                      >
                        Enter
                      </button>
                      <button
                        type="button"
                        disabled={!live || busy}
                        onClick={() =>
                          void run(() => act({ type: "scroll", x: 0, y: 500 }))
                        }
                      >
                        向下滚动
                      </button>
                    </div>
                    <div className="elements">
                      {elements.map((el) => (
                        <div className="element" key={el.ref}>
                          <small className="mono">{el.role}</small>
                          <span>{el.text || "未命名元素"}</span>
                          <button
                            type="button"
                            disabled={busy || !live}
                            onClick={() =>
                              void run(() =>
                                act(
                                  el.role === "input" || el.role === "textarea"
                                    ? { type: "fill", ref: el.ref, text }
                                    : { type: "click", ref: el.ref },
                                ),
                              )
                            }
                          >
                            {el.role === "input" || el.role === "textarea"
                              ? "填写"
                              : "点击"}
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="import">
                      <h3>登录状态</h3>
                      <p className="hint">
                        仅导入你明确授权的网站。不要把日常账号发到公共测试任务。
                      </p>
                      <button
                        type="button"
                        disabled={
                          !live || busy || !me.human || s.platform !== "browser"
                        }
                        onClick={() =>
                          void run(async () => {
                            const latest = await client.get(s.id);
                            if (latest.actor !== me.actor)
                              throw Error("CONTROL_LOST");
                            const current = await client.claim(
                              s.id,
                              latest.epoch,
                            );
                            const t = await client.request<{ id: string }>(
                              `/api/sessions/${s.id}/import`,
                              "POST",
                              {
                                origin: new URL(url).origin,
                                epoch: current.epoch,
                              },
                            );
                            setTicket(
                              JSON.stringify({
                                ...t,
                                transferURL: new URL(
                                  `/transfer/${t.id}`,
                                  location.origin,
                                ).href,
                              }),
                            );
                            await refresh();
                          })
                        }
                      >
                        生成导入授权
                      </button>
                      {ticket && (
                        <>
                          <label htmlFor="ticket">
                            复制到扩展（60 秒有效）
                          </label>
                          <textarea id="ticket" readOnly value={ticket} />
                          <button
                            type="button"
                            onClick={() =>
                              void run(async () => {
                                await client.request(
                                  `/api/sessions/${s.id}/import`,
                                  "DELETE",
                                );
                                setTicket("");
                              })
                            }
                          >
                            撤销授权
                          </button>
                        </>
                      )}
                    </div>
                  </aside>
                </div>
                <p className="notice" role="status">
                  {notice || "页面可能含敏感信息；默认不录像，不保存截图。"}
                </p>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
