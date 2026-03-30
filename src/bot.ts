import "dotenv/config";
import { Bot, InlineKeyboard } from "grammy";

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEB_APP_URL = process.env.WEB_APP_URL?.trim();
const MENU_BUTTON_TEXT = (process.env.MENU_BUTTON_TEXT ?? "Подписки").trim() || "Подписки";

if (!BOT_TOKEN) {
  console.error("Укажите BOT_TOKEN в .env (см. .env.example)");
  process.exit(1);
}

const bot = new Bot(BOT_TOKEN);

function webAppKeyboard() {
  const kb = new InlineKeyboard();
  if (WEB_APP_URL) {
    kb.webApp(MENU_BUTTON_TEXT, WEB_APP_URL);
  }
  return kb;
}

bot.command("start", async (ctx) => {
  if (!WEB_APP_URL) {
    await ctx.reply(
      "Mini App пока не настроен: задайте WEB_APP_URL в .env (HTTPS, например через ngrok).",
    );
    return;
  }

  await ctx.reply(
    "Откройте менеджер подписок — кнопка ниже или пункт меню внизу чата.",
    { reply_markup: webAppKeyboard() },
  );
});

bot.on("message:text", async (ctx) => {
  if (ctx.message.text.startsWith("/")) return;
  if (!WEB_APP_URL) {
    await ctx.reply("Сначала настройте WEB_APP_URL в .env.");
    return;
  }
  await ctx.reply("Откройте приложение через кнопку или меню.", {
    reply_markup: webAppKeyboard(),
  });
});

async function setDefaultMenuButton() {
  if (!WEB_APP_URL) {
    console.warn("WEB_APP_URL не задан — кнопка меню Web App не установлена.");
    return;
  }
  await bot.api.setChatMenuButton({
    menu_button: {
      type: "web_app",
      text: MENU_BUTTON_TEXT,
      web_app: { url: WEB_APP_URL },
    },
  });
  console.log("Пункт меню Web App установлен по умолчанию для приватных чатов.");
}

await bot.init();
await setDefaultMenuButton();
console.log("Бот запущен (long polling). Ctrl+C — остановить.");
await bot.start();
