import { formatInTimeZone } from "date-fns-tz";
import type { Bot } from "grammy";
import { prisma } from "./db.js";
import { ymdSubDays } from "./dates.js";

function formatMoney(amountCents: number, currency: string): string {
  return `${(amountCents / 100).toFixed(2)} ${currency}`;
}

export function startReminderLoop(bot: Bot): void {
  setInterval(() => {
    void runReminders(bot);
  }, 60_000);
}

async function runReminders(bot: Bot): Promise<void> {
  const subs = await prisma.subscription.findMany({ include: { user: true } });
  const now = new Date();

  for (const s of subs) {
    const tz = s.user.timezone || "UTC";
    const today = formatInTimeZone(now, tz, "yyyy-MM-dd");
    const daysBefore = s.reminderDaysBefore ?? 1;
    const reminderDay = ymdSubDays(s.nextChargeOn, daysBefore);
    if (reminderDay !== today) continue;

    const already = await prisma.reminderLog.findFirst({
      where: {
        subscriptionId: s.id,
        forChargeOn: s.nextChargeOn,
      },
    });
    if (already) continue;

    const chatId = s.user.telegramId.toString();
    const text = `Напоминание: через ${daysBefore} дн. списание по «${s.name}» — ${formatMoney(s.amountCents, s.currency)}`;

    try {
      await bot.api.sendMessage(chatId, text);
      await prisma.reminderLog.create({
        data: {
          subscriptionId: s.id,
          forChargeOn: s.nextChargeOn,
        },
      });
    } catch (e) {
      console.error("Reminder send failed", s.id, e);
    }
  }
}
