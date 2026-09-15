let approved;
const status = document.getElementById("result");
const send = document.getElementById("send");
document.getElementById("review").onclick = async () => {
  approved = undefined;
  send.disabled = true;
  try {
    const t = JSON.parse(document.getElementById("ticket").value);
    const destination = new URL(t.transferURL);
    if (
      destination.protocol !== "https:" &&
      !(
        destination.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(destination.hostname)
      )
    )
      throw Error("目标必须使用 HTTPS");
    if (
      !/^[a-f0-9]{64}$/.test(t.id) ||
      destination.pathname !== `/transfer/${t.id}` ||
      t.expires <= Date.now()
    )
      throw Error("授权无效或已过期");
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (new URL(tab.url).origin !== t.origin)
      throw Error("当前网站与授权网站不同");
    document.getElementById("target").textContent =
      `${t.origin} → ${destination.origin} / 会话 ${t.session}。请确认这是你自己的服务。`;
    approved = { t, tabId: tab.id, destination };
    send.disabled = false;
    status.textContent = "";
  } catch (e) {
    status.textContent = e.message;
  }
};
send.onclick = async () => {
  if (!approved) return;
  const { t, tabId, destination } = approved;
  // Permission prompt must originate directly from the user's click.
  const permission = chrome.permissions.request({
    origins: [`${t.origin}/*`, `${destination.origin}/*`],
  });
  send.disabled = true;
  approved = undefined;
  try {
    if (!(await permission)) throw Error("已取消，未导出数据");
    if (Date.now() >= t.expires) throw Error("授权已过期");
    const current = await chrome.tabs.get(tabId);
    if (new URL(current.url).origin !== t.origin) throw Error("当前网站已改变");
    const hostname = new URL(t.origin).hostname;
    const all = await chrome.cookies.getAll({ url: t.origin });
    const cookies = all
      .filter(
        (c) => !c.partitionKey && c.domain.replace(/^\./, "") === hostname,
      )
      .map((c) => ({
        name: c.name,
        value: c.value,
        path: c.path,
        expires: c.expirationDate,
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: {
          strict: "Strict",
          lax: "Lax",
          no_restriction: "None",
          unspecified: "Lax",
        }[c.sameSite],
      }));
    const [storage] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (expected) => {
        if (location.origin !== expected) throw Error("网站已改变");
        return Object.entries(localStorage).map(([name, value]) => ({
          name,
          value,
        }));
      },
      args: [t.origin],
    });
    const payload = new TextEncoder().encode(
      JSON.stringify({ cookies, localStorage: storage.result }),
    );
    if (payload.length > 70000) throw Error("网站数据过大，未发送");
    const rsa = await crypto.subtle.importKey(
      "jwk",
      t.publicKey,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["encrypt"],
    );
    const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt"],
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const additionalData = new TextEncoder().encode(
      JSON.stringify([t.id, t.session, t.origin, t.expires]),
    );
    const b64 = (bytes) =>
      btoa(
        Array.from(new Uint8Array(bytes), (v) => String.fromCharCode(v)).join(
          "",
        ),
      );
    const envelope = {
      key: b64(
        await crypto.subtle.encrypt(
          "RSA-OAEP",
          rsa,
          await crypto.subtle.exportKey("raw", key),
        ),
      ),
      iv: b64(iv),
      data: b64(
        await crypto.subtle.encrypt(
          { name: "AES-GCM", iv, additionalData },
          key,
          payload,
        ),
      ),
    };
    const response = await fetch(destination.href, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(envelope),
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw Error("导入未确认。不要自动重试，请回控制台检查目标会话。");
    status.textContent =
      "已写入。请在目标浏览器确认登录。分区 cookie、IndexedDB、设备绑定登录未迁移。";
    document.getElementById("ticket").value = "";
  } catch (e) {
    status.textContent = e.message;
  }
};
