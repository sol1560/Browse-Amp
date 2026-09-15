import { readFile } from "node:fs/promises";
import { z } from "zod";
import { actionSchema } from "../../packages/core/types.js";
import { BrowseClient } from "../../packages/sdk/index.js";

const [command, id, arg] = process.argv.slice(2);
if (!command || command === "help") {
  console.log(
    "browse: list | create <name> | observe <id> | claim <id> | act <id> <action.json> | stop <id>\n设置 BROWSE_URL 和 BROWSE_TOKEN；不自动重试动作。",
  );
} else {
  const client = new BrowseClient(
    process.env.BROWSE_URL || "http://127.0.0.1:3000",
    z.string().min(32).parse(process.env.BROWSE_TOKEN),
  );
  let result: unknown;
  if (command === "list") result = await client.list();
  else if (command === "create")
    result = await client.create(z.string().min(1).parse(id));
  else {
    z.uuid().parse(id);
    if (command === "observe") result = await client.observe(id);
    else if (command === "stop") result = await client.stop(id);
    else if (command === "claim")
      result = await client.claim(id, (await client.get(id)).epoch);
    else if (command === "act")
      result = await client.act(
        id,
        (await client.get(id)).epoch,
        actionSchema.parse(JSON.parse(await readFile(arg, "utf8"))),
      );
    else throw Error("UNKNOWN_COMMAND");
  }
  console.log(JSON.stringify(result, null, 2));
}
