import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerApi } from "./routes/api.js";

export async function buildServer(botToken: string) {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });
  await registerApi(app, { botToken });
  return app;
}
