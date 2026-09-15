import { z } from "zod";

export class ControlError extends Error {
  constructor(
    public code: string,
    public status = 409,
  ) {
    super(code);
  }
}
export type Principal = { user: string; actor: string; human: boolean };
export type Session = {
  id: string;
  owner: string;
  actor: string;
  name: string;
  platform: string;
  status: string;
  epoch: number;
  lease_until: number;
  expires_at: number;
};
export const actionSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("pointer"),
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
    })
    .strict(),
  z.object({ type: z.literal("type"), text: z.string().max(10000) }).strict(),
  z.object({ type: z.literal("navigate"), url: z.url().max(4096) }).strict(),
  z.object({ type: z.literal("click"), ref: z.string().max(100) }).strict(),
  z
    .object({
      type: z.literal("fill"),
      ref: z.string().max(100),
      text: z.string().max(10000),
    })
    .strict(),
  z.object({ type: z.literal("press"), key: z.string().max(100) }).strict(),
  z
    .object({
      type: z.literal("scroll"),
      x: z.number().min(-5000).max(5000),
      y: z.number().min(-5000).max(5000),
    })
    .strict(),
]);
export type Action = z.infer<typeof actionSchema>;
export type Driver = {
  observe(): Promise<unknown>;
  screenshot(): Promise<Buffer>;
  act(action: Action): Promise<void>;
  close(): Promise<void>;
};
export const commandSchema = z
  .object({
    requestId: z.uuid(),
    epoch: z.number().int().nonnegative(),
    deadline: z.number().int().positive(),
    action: actionSchema,
  })
  .strict();
export type Command = z.infer<typeof commandSchema>;
