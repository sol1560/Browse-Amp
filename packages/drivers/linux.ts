import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { type Action, ControlError, type Driver } from "../core/types.js";

const exec = promisify(execFile);
export class LinuxDesktop implements Driver {
  constructor(readonly display: string) {}
  private async run(command: string, args: string[]) {
    return exec(command, args, {
      env: { ...process.env, DISPLAY: this.display },
      timeout: 5000,
      maxBuffer: 8 * 1024 * 1024,
    });
  }
  async size() {
    const { stdout } = await this.run("xdotool", ["getdisplaygeometry"]);
    const [width, height] = stdout.trim().split(/\s+/).map(Number);
    if (!width || !height) throw new ControlError("DISPLAY_UNAVAILABLE", 503);
    return { width, height };
  }
  async observe() {
    return {
      title: "Linux X11 桌面",
      url: "",
      elements: [],
      viewport: await this.size(),
      note: "真实桌面；元素树尚未提供。",
    };
  }
  async screenshot() {
    const { stdout } = await exec(
      "import",
      ["-display", this.display, "-window", "root", "-quality", "75", "jpeg:-"],
      { encoding: "buffer", timeout: 5000, maxBuffer: 8 * 1024 * 1024 },
    );
    return stdout;
  }
  async act(action: Action) {
    if (action.type === "pointer") {
      const { width, height } = await this.size();
      await this.run("xdotool", [
        "mousemove",
        String(Math.min(width - 1, Math.floor(action.x * width))),
        String(Math.min(height - 1, Math.floor(action.y * height))),
        "click",
        "1",
      ]);
    } else if (action.type === "type")
      await this.run("xdotool", [
        "type",
        "--clearmodifiers",
        "--delay",
        "1",
        "--",
        action.text,
      ]);
    else if (action.type === "press") {
      if (!/^[a-zA-Z0-9_+]+$/.test(action.key))
        throw new ControlError("INVALID_KEY", 400);
      const key = action.key === "Enter" ? "Return" : action.key;
      await this.run("xdotool", ["key", "--clearmodifiers", key]);
    } else if (action.type === "scroll") {
      if (action.x) throw new ControlError("UNSUPPORTED_CAPABILITY", 422);
      if (action.y)
        await this.run("xdotool", [
          "click",
          "--repeat",
          String(Math.min(20, Math.ceil(Math.abs(action.y) / 100))),
          "--delay",
          "20",
          action.y > 0 ? "5" : "4",
        ]);
    } else throw new ControlError("UNSUPPORTED_CAPABILITY", 422);
  }
  async close() {
    /* Disconnect only. Never close the user's applications. */
  }
}
