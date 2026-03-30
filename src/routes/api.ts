import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import {
  parseUserFromInitData,
  validateTelegramWebAppData,
} from "../auth/initData.js";
import { ymdAddMonths } from "../dates.js";

function parseOccupied(raw: string): string[] {
  try {
    const a = JSON.parse(raw) as unknown;
    return Array.isArray(a) ? a.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

async function getOrCreateUser(telegramId: bigint, firstName?: string) {
  let user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) {
    user = await prisma.user.create({
      data: { telegramId, firstName: firstName ?? null },
    });
  } else if (firstName && user.firstName !== firstName) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { firstName },
    });
  }
  return user;
}

export async function registerApi(
  app: FastifyInstance,
  opts: { botToken: string },
) {
  app.addHook("preHandler", async (req, reply) => {
    const path = req.url.split("?")[0] ?? "";
    if (path === "/api/health" || !path.startsWith("/api")) return;
    const auth = req.headers.authorization;
    if (!auth?.startsWith("tma ")) {
      return reply.code(401).send({ error: "Требуется авторизация Telegram" });
    }
    const initData = auth.slice(4);
    if (!validateTelegramWebAppData(initData, opts.botToken)) {
      return reply.code(401).send({ error: "Неверные данные initData" });
    }
    const parsed = parseUserFromInitData(initData);
    if (!parsed) {
      return reply.code(401).send({ error: "Нет пользователя в initData" });
    }
    const user = await getOrCreateUser(parsed.id, parsed.firstName);
    req.userId = user.id;
  });

  app.get("/api/health", async () => ({ ok: true }));

  app.get("/api/me", async (req) => {
    const userId = req.userId!;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      id: user.id,
      telegramId: user.telegramId.toString(),
      timezone: user.timezone,
      firstName: user.firstName,
    };
  });

  app.patch<{ Body: { timezone?: string } }>("/api/me", async (req) => {
    const userId = req.userId!;
    const tz = req.body?.timezone?.trim();
    if (!tz) {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      return {
        id: user.id,
        telegramId: user.telegramId.toString(),
        timezone: user.timezone,
        firstName: user.firstName,
      };
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data: { timezone: tz },
    });
    return {
      id: user.id,
      telegramId: user.telegramId.toString(),
      timezone: user.timezone,
      firstName: user.firstName,
    };
  });

  app.get("/api/categories", async (req) => {
    const userId = req.userId!;
    const system = await prisma.category.findMany({
      where: { userId: null },
      orderBy: { slug: "asc" },
    });
    const custom = await prisma.category.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    });
    return {
      system: system.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
      })),
      custom: custom.map((c) => ({ id: c.id, name: c.name })),
    };
  });

  app.post<{ Body: { name?: string } }>("/api/categories", async (req, reply) => {
    const userId = req.userId!;
    const name = req.body?.name?.trim();
    if (!name) {
      return reply.code(400).send({ error: "Укажите название" });
    }
    const cat = await prisma.category.create({
      data: { userId, name },
    });
    return { id: cat.id, name: cat.name };
  });

  app.delete<{ Params: { id: string } }>(
    "/api/categories/:id",
    async (req, reply) => {
      const userId = req.userId!;
      const cat = await prisma.category.findFirst({
        where: { id: req.params.id, userId },
      });
      if (!cat) return reply.code(404).send({ error: "Не найдено" });
      await prisma.category.delete({ where: { id: cat.id } });
      return { ok: true };
    },
  );

  app.get("/api/payment-cards", async (req) => {
    const userId = req.userId!;
    const cards = await prisma.paymentCard.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    });
    return cards.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
    }));
  });

  app.post<{
    Body: { name?: string; color?: string };
  }>("/api/payment-cards", async (req, reply) => {
    const userId = req.userId!;
    const name = req.body?.name?.trim();
    const color = req.body?.color?.trim() ?? "#3390ec";
    if (!name) return reply.code(400).send({ error: "Укажите название" });
    const card = await prisma.paymentCard.create({
      data: { userId, name, color },
    });
    return { id: card.id, name: card.name, color: card.color };
  });

  app.patch<{
    Params: { id: string };
    Body: { name?: string; color?: string };
  }>("/api/payment-cards/:id", async (req, reply) => {
    const userId = req.userId!;
    const card = await prisma.paymentCard.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!card) return reply.code(404).send({ error: "Не найдено" });
    const updated = await prisma.paymentCard.update({
      where: { id: card.id },
      data: {
        name: req.body.name?.trim() ?? card.name,
        color: req.body.color?.trim() ?? card.color,
      },
    });
    return {
      id: updated.id,
      name: updated.name,
      color: updated.color,
    };
  });

  app.delete<{ Params: { id: string } }>(
    "/api/payment-cards/:id",
    async (req, reply) => {
      const userId = req.userId!;
      const card = await prisma.paymentCard.findFirst({
        where: { id: req.params.id, userId },
      });
      if (!card) return reply.code(404).send({ error: "Не найдено" });
      await prisma.paymentCard.delete({ where: { id: card.id } });
      return { ok: true };
    },
  );

  app.get("/api/subscriptions", async (req) => {
    const userId = req.userId!;
    const rows = await prisma.subscription.findMany({
      where: { userId },
      include: { category: true, paymentCard: true },
      orderBy: { nextChargeOn: "asc" },
    });
    return rows.map((s) => ({
      id: s.id,
      name: s.name,
      amountCents: s.amountCents,
      currency: s.currency,
      intervalMonths: s.intervalMonths,
      nextChargeOn: s.nextChargeOn,
      reminderDaysBefore: s.reminderDaysBefore,
      category: s.category
        ? { id: s.category.id, name: s.category.name, slug: s.category.slug }
        : null,
      paymentCard: s.paymentCard
        ? { id: s.paymentCard.id, name: s.paymentCard.name, color: s.paymentCard.color }
        : null,
      slotCount: s.slotCount,
      occupiedNames: parseOccupied(s.occupiedNames),
    }));
  });

  app.post<{
    Body: {
      name?: string;
      amountCents?: number;
      currency?: string;
      intervalMonths?: number;
      nextChargeOn?: string;
      reminderDaysBefore?: number | null;
      categoryId?: string | null;
      paymentCardId?: string | null;
      slotCount?: number | null;
      occupiedNames?: string[] | null;
    };
  }>("/api/subscriptions", async (req, reply) => {
    const userId = req.userId!;
    const b = req.body;
    const name = b.name?.trim();
    if (!name) return reply.code(400).send({ error: "Укажите название" });
    if (typeof b.amountCents !== "number" || b.amountCents < 0) {
      return reply.code(400).send({ error: "Укажите сумму" });
    }
    const currency = b.currency?.trim().toUpperCase();
    if (!currency || currency.length !== 3) {
      return reply.code(400).send({ error: "Валюта — 3 буквы (например RUB)" });
    }
    const intervalMonths = b.intervalMonths ?? 1;
    if (![1, 3, 6, 12].includes(intervalMonths)) {
      return reply.code(400).send({ error: "Период: 1, 3, 6 или 12 месяцев" });
    }
    const nextChargeOn = b.nextChargeOn?.trim();
    if (!nextChargeOn || !/^\d{4}-\d{2}-\d{2}$/.test(nextChargeOn)) {
      return reply.code(400).send({ error: "Дата следующего списания YYYY-MM-DD" });
    }
    const occupied = b.occupiedNames?.filter(Boolean) ?? [];
    if (b.slotCount != null && occupied.length > b.slotCount) {
      return reply.code(400).send({ error: "Имён больше, чем слотов" });
    }
    if (b.categoryId) {
      const ok = await prisma.category.findFirst({
        where: {
          id: b.categoryId,
          OR: [{ userId: null }, { userId }],
        },
      });
      if (!ok) return reply.code(400).send({ error: "Категория не найдена" });
    }
    if (b.paymentCardId) {
      const ok = await prisma.paymentCard.findFirst({
        where: { id: b.paymentCardId, userId },
      });
      if (!ok) return reply.code(400).send({ error: "Карта не найдена" });
    }
    const sub = await prisma.subscription.create({
      data: {
        userId,
        name,
        amountCents: b.amountCents,
        currency,
        intervalMonths,
        nextChargeOn,
        reminderDaysBefore: b.reminderDaysBefore ?? null,
        categoryId: b.categoryId ?? null,
        paymentCardId: b.paymentCardId ?? null,
        slotCount: b.slotCount ?? null,
        occupiedNames: JSON.stringify(occupied),
      },
      include: { category: true, paymentCard: true },
    });
    return mapSubscription(sub);
  });

  app.patch<{
    Params: { id: string };
    Body: Partial<{
      name: string;
      amountCents: number;
      currency: string;
      intervalMonths: number;
      nextChargeOn: string;
      reminderDaysBefore: number | null;
      categoryId: string | null;
      paymentCardId: string | null;
      slotCount: number | null;
      occupiedNames: string[] | null;
    }>;
  }>("/api/subscriptions/:id", async (req, reply) => {
    const userId = req.userId!;
    const existing = await prisma.subscription.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!existing) return reply.code(404).send({ error: "Не найдено" });
    const b = req.body;
    const occupied = b.occupiedNames ?? parseOccupied(existing.occupiedNames);
    const slotCount = b.slotCount ?? existing.slotCount;
    if (slotCount != null && occupied.length > slotCount) {
      return reply.code(400).send({ error: "Имён больше, чем слотов" });
    }
    if (b.categoryId !== undefined && b.categoryId !== null) {
      const ok = await prisma.category.findFirst({
        where: { id: b.categoryId, OR: [{ userId: null }, { userId }] },
      });
      if (!ok) return reply.code(400).send({ error: "Категория не найдена" });
    }
    if (b.paymentCardId !== undefined && b.paymentCardId !== null) {
      const ok = await prisma.paymentCard.findFirst({
        where: { id: b.paymentCardId, userId },
      });
      if (!ok) return reply.code(400).send({ error: "Карта не найдена" });
    }
    const sub = await prisma.subscription.update({
      where: { id: existing.id },
      data: {
        name: b.name?.trim() ?? undefined,
        amountCents: b.amountCents,
        currency: b.currency?.trim().toUpperCase(),
        intervalMonths: b.intervalMonths,
        nextChargeOn: b.nextChargeOn?.trim(),
        reminderDaysBefore: b.reminderDaysBefore,
        categoryId: b.categoryId,
        paymentCardId: b.paymentCardId,
        slotCount: b.slotCount,
        occupiedNames:
          b.occupiedNames !== undefined
            ? JSON.stringify(occupied)
            : undefined,
      },
      include: { category: true, paymentCard: true },
    });
    return mapSubscription(sub);
  });

  app.delete<{ Params: { id: string } }>(
    "/api/subscriptions/:id",
    async (req, reply) => {
      const userId = req.userId!;
      const existing = await prisma.subscription.findFirst({
        where: { id: req.params.id, userId },
      });
      if (!existing) return reply.code(404).send({ error: "Не найдено" });
      await prisma.subscription.delete({ where: { id: existing.id } });
      return { ok: true };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/subscriptions/:id/confirm-payment",
    async (req, reply) => {
      const userId = req.userId!;
      const existing = await prisma.subscription.findFirst({
        where: { id: req.params.id, userId },
      });
      if (!existing) return reply.code(404).send({ error: "Не найдено" });
      const next = ymdAddMonths(existing.nextChargeOn, existing.intervalMonths);
      const sub = await prisma.subscription.update({
        where: { id: existing.id },
        data: { nextChargeOn: next },
        include: { category: true, paymentCard: true },
      });
      await prisma.reminderLog.deleteMany({
        where: { subscriptionId: existing.id, forChargeOn: existing.nextChargeOn },
      });
      return mapSubscription(sub);
    },
  );
}

function mapSubscription(s: {
  id: string;
  name: string;
  amountCents: number;
  currency: string;
  intervalMonths: number;
  nextChargeOn: string;
  reminderDaysBefore: number | null;
  slotCount: number | null;
  occupiedNames: string;
  category: { id: string; name: string; slug: string | null } | null;
  paymentCard: { id: string; name: string; color: string } | null;
}) {
  return {
    id: s.id,
    name: s.name,
    amountCents: s.amountCents,
    currency: s.currency,
    intervalMonths: s.intervalMonths,
    nextChargeOn: s.nextChargeOn,
    reminderDaysBefore: s.reminderDaysBefore,
    category: s.category
      ? { id: s.category.id, name: s.category.name, slug: s.category.slug }
      : null,
    paymentCard: s.paymentCard
      ? { id: s.paymentCard.id, name: s.paymentCard.name, color: s.paymentCard.color }
      : null,
    slotCount: s.slotCount,
    occupiedNames: parseOccupied(s.occupiedNames),
  };
}
