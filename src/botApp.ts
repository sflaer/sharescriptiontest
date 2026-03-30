import { Bot, InlineKeyboard } from "grammy";

const MENU_BUTTON_TEXT = (process.env.MENU_BUTTON_TEXT ?? "Подписки").trim() || "Подписки";

export function createBot(token: string): Bot {
  return new Bot(token);
}

export function registerBotCommands(
  bot: Bot,
  webAppUrl: string | undefined,
): void {
  function webAppKeyboard() {
    const kb = new InlineKeyboard();
    if (webAppUrl) kb.webApp(MENU_BUTTON_TEXT, webAppUrl);
    return kb;
  }

  bot.command("start", async (ctx) => {
    if (!webAppUrl) {
      await ctx.reply(
        "Mini App не настроен: задайте WEB_APP_URL (HTTPS).",
      );
      return;
    }
    await ctx.reply(
      "Откройте менеджер подписок — кнопка ниже или меню внизу чата.",
      { reply_markup: webAppKeyboard() },
    );
  });

  bot.on("message:text", async (ctx) => {
    if (ctx.message.text.startsWith("/")) return;
    if (!webAppUrl) {
      await ctx.reply("Сначала настройте WEB_APP_URL.");
      return;
    }
    await ctx.reply("Откройте приложение через кнопку или меню.", {
      reply_markup: webAppKeyboard(),
    });
  });
}

export async function setWebAppMenuButton(
  bot: Bot,
  webAppUrl: string | undefined,
): Promise<void> {
  if (!webAppUrl) {
    console.warn("WEB_APP_URL не задан — меню Web App не установлено.");
    return;
  }
  await bot.api.setChatMenuButton({
    menu_button: {
      type: "web_app",
      text: MENU_BUTTON_TEXT,
      web_app: { url: webAppUrl },
    },
  });
  console.log("Меню Web App установлено.");
}
