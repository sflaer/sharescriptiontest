import "dotenv/config";
import { createBot, registerBotCommands, setWebAppMenuButton } from "./botApp.js";
import { buildServer } from "./server.js";
import { startReminderLoop } from "./reminders.js";

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEB_APP_URL = process.env.WEB_APP_URL?.trim();
const PORT = Number(process.env.PORT ?? 3001);

if (!BOT_TOKEN) {
  console.error("Укажите BOT_TOKEN в .env");
  process.exit(1);
}

const app = await buildServer(BOT_TOKEN);
await app.listen({ port: PORT, host: "0.0.0.0" });
console.log(`API: http://127.0.0.1:${PORT}`);

const bot = createBot(BOT_TOKEN);
registerBotCommands(bot, WEB_APP_URL);
await bot.init();
await setWebAppMenuButton(bot, WEB_APP_URL);
startReminderLoop(bot);
console.log("Бот: long polling + напоминания каждые 60 с.");
await bot.start();
