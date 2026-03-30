const base = import.meta.env.VITE_API_URL ?? "";

export type Me = {
  id: string;
  telegramId: string;
  timezone: string;
  firstName: string | null;
};

export type PaymentCardDto = { id: string; name: string; color: string };

export type SubscriptionDto = {
  id: string;
  name: string;
  amountCents: number;
  currency: string;
  intervalMonths: number;
  nextChargeOn: string;
  reminderDaysBefore: number | null;
  category: { id: string; name: string; slug: string | null } | null;
  paymentCard: PaymentCardDto | null;
  slotCount: number | null;
  occupiedNames: string[];
};

function authHeaders(initData: string): HeadersInit {
  return {
    Authorization: `tma ${initData}`,
    "Content-Type": "application/json",
  };
}

async function parseJson<T>(r: Response): Promise<T> {
  const text = await r.text();
  if (!r.ok) {
    try {
      const j = JSON.parse(text) as { error?: string };
      throw new Error(j.error ?? r.statusText);
    } catch {
      throw new Error(text || r.statusText);
    }
  }
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

export async function apiGetMe(initData: string): Promise<Me> {
  const r = await fetch(`${base}/api/me`, { headers: authHeaders(initData) });
  return parseJson<Me>(r);
}

export async function apiPatchMe(
  initData: string,
  body: { timezone: string },
): Promise<Me> {
  const r = await fetch(`${base}/api/me`, {
    method: "PATCH",
    headers: authHeaders(initData),
    body: JSON.stringify(body),
  });
  return parseJson<Me>(r);
}

export async function apiGetCategories(initData: string): Promise<{
  system: { id: string; slug: string | null; name: string }[];
  custom: { id: string; name: string }[];
}> {
  const r = await fetch(`${base}/api/categories`, {
    headers: authHeaders(initData),
  });
  return parseJson(r);
}

export async function apiCreateCategory(
  initData: string,
  name: string,
): Promise<{ id: string; name: string }> {
  const r = await fetch(`${base}/api/categories`, {
    method: "POST",
    headers: authHeaders(initData),
    body: JSON.stringify({ name }),
  });
  return parseJson(r);
}

export async function apiDeleteCategory(
  initData: string,
  id: string,
): Promise<void> {
  const r = await fetch(`${base}/api/categories/${id}`, {
    method: "DELETE",
    headers: authHeaders(initData),
  });
  await parseJson(r);
}

export async function apiGetCards(initData: string): Promise<PaymentCardDto[]> {
  const r = await fetch(`${base}/api/payment-cards`, {
    headers: authHeaders(initData),
  });
  return parseJson(r);
}

export async function apiCreateCard(
  initData: string,
  body: { name: string; color: string },
): Promise<PaymentCardDto> {
  const r = await fetch(`${base}/api/payment-cards`, {
    method: "POST",
    headers: authHeaders(initData),
    body: JSON.stringify(body),
  });
  return parseJson(r);
}

export async function apiCreateSubscription(
  initData: string,
  body: Record<string, unknown>,
): Promise<SubscriptionDto> {
  const r = await fetch(`${base}/api/subscriptions`, {
    method: "POST",
    headers: authHeaders(initData),
    body: JSON.stringify(body),
  });
  return parseJson(r);
}

export async function apiPatchSubscription(
  initData: string,
  id: string,
  body: Record<string, unknown>,
): Promise<SubscriptionDto> {
  const r = await fetch(`${base}/api/subscriptions/${id}`, {
    method: "PATCH",
    headers: authHeaders(initData),
    body: JSON.stringify(body),
  });
  return parseJson(r);
}

export async function apiDeleteSubscription(
  initData: string,
  id: string,
): Promise<void> {
  const r = await fetch(`${base}/api/subscriptions/${id}`, {
    method: "DELETE",
    headers: authHeaders(initData),
  });
  await parseJson(r);
}

export async function apiConfirmPayment(
  initData: string,
  id: string,
): Promise<SubscriptionDto> {
  const r = await fetch(`${base}/api/subscriptions/${id}/confirm-payment`, {
    method: "POST",
    headers: authHeaders(initData),
  });
  return parseJson(r);
}

export async function apiGetSubscriptions(
  initData: string,
): Promise<SubscriptionDto[]> {
  const r = await fetch(`${base}/api/subscriptions`, {
    headers: authHeaders(initData),
  });
  return parseJson(r);
}
