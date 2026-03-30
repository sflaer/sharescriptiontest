import { format } from "date-fns";
import { useEffect, useState } from "react";
import {
  apiCreateSubscription,
  apiGetCards,
  apiGetCategories,
  apiPatchSubscription,
  type SubscriptionDto,
} from "./api";

type Props = {
  initData: string;
  initial: SubscriptionDto | null;
  onClose: () => void;
  onSaved: () => void;
};

const INTERVALS = [1, 3, 6, 12] as const;

export function SubscriptionEditor({
  initData,
  initial,
  onClose,
  onSaved,
}: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(
    initial ? String(initial.amountCents / 100) : "",
  );
  const [currency, setCurrency] = useState(initial?.currency ?? "RUB");
  const [intervalMonths, setIntervalMonths] = useState(
    initial?.intervalMonths ?? 1,
  );
  const [nextChargeOn, setNextChargeOn] = useState(
    initial?.nextChargeOn ?? format(new Date(), "yyyy-MM-dd"),
  );
  const [reminderDays, setReminderDays] = useState(
    initial?.reminderDaysBefore != null
      ? String(initial.reminderDaysBefore)
      : "",
  );
  const [categoryId, setCategoryId] = useState(initial?.category?.id ?? "");
  const [paymentCardId, setPaymentCardId] = useState(
    initial?.paymentCard?.id ?? "",
  );
  const [slotCount, setSlotCount] = useState(
    initial?.slotCount != null ? String(initial.slotCount) : "",
  );
  const [occupiedText, setOccupiedText] = useState(
    initial?.occupiedNames?.join("\n") ?? "",
  );

  const [cats, setCats] = useState<{
    system: { id: string; name: string }[];
    custom: { id: string; name: string }[];
  } | null>(null);
  const [cards, setCards] = useState<{ id: string; name: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [c, cr] = await Promise.all([
          apiGetCategories(initData),
          apiGetCards(initData),
        ]);
        setCats({ system: c.system, custom: c.custom });
        setCards(cr);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Ошибка");
      }
    })();
  }, [initData]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const amountCents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
    if (!name.trim() || Number.isNaN(amountCents) || amountCents < 0) {
      setErr("Проверьте название и сумму");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextChargeOn)) {
      setErr("Дата YYYY-MM-DD");
      return;
    }
    const occupiedNames = occupiedText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const sc = slotCount.trim() ? parseInt(slotCount, 10) : null;
    if (sc != null && Number.isNaN(sc)) {
      setErr("Неверное число слотов");
      return;
    }
    if (sc != null && occupiedNames.length > sc) {
      setErr("Имён больше, чем слотов");
      return;
    }
    const rd = reminderDays.trim() ? parseInt(reminderDays, 10) : null;
    if (rd != null && (Number.isNaN(rd) || rd < 0)) {
      setErr("Напоминание: целое число дней");
      return;
    }

    const body: Record<string, unknown> = {
      name: name.trim(),
      amountCents,
      currency: currency.trim().toUpperCase().slice(0, 3),
      intervalMonths,
      nextChargeOn,
      reminderDaysBefore: rd === null ? null : rd,
      categoryId: categoryId || null,
      paymentCardId: paymentCardId || null,
      slotCount: sc,
      occupiedNames,
    };

    setBusy(true);
    try {
      if (initial) {
        await apiPatchSubscription(initData, initial.id, body);
      } else {
        await apiCreateSubscription(initData, body);
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{initial ? "Подписка" : "Новая подписка"}</h2>
        <form onSubmit={submit} className="form">
          {err && <p className="error">{err}</p>}
          <label>
            Название
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label>
            Сумма
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              required
            />
          </label>
          <label>
            Валюта (3 буквы)
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              maxLength={3}
              required
            />
          </label>
          <label>
            Период (мес.)
            <select
              value={intervalMonths}
              onChange={(e) => setIntervalMonths(Number(e.target.value))}
            >
              {INTERVALS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            След. списание (YYYY-MM-DD)
            <input
              value={nextChargeOn}
              onChange={(e) => setNextChargeOn(e.target.value)}
              placeholder="2026-04-01"
              required
            />
          </label>
          <label>
            Напоминание за N дней (пусто = 1)
            <input
              value={reminderDays}
              onChange={(e) => setReminderDays(e.target.value)}
              inputMode="numeric"
            />
          </label>
          <label>
            Категория
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">—</option>
              {cats?.system.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              {cats?.custom.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (своя)
                </option>
              ))}
            </select>
          </label>
          <label>
            Карта оплаты
            <select
              value={paymentCardId}
              onChange={(e) => setPaymentCardId(e.target.value)}
            >
              <option value="">—</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Число слотов (необязательно)
            <input
              value={slotCount}
              onChange={(e) => setSlotCount(e.target.value)}
              inputMode="numeric"
            />
          </label>
          <label>
            Имена в слотах (по строке или через запятую)
            <textarea
              value={occupiedText}
              onChange={(e) => setOccupiedText(e.target.value)}
              rows={3}
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? "…" : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
