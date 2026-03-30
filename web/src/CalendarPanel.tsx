import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  startOfMonth,
} from "date-fns";
import { ru } from "date-fns/locale";
import { useEffect, useMemo, useState } from "react";
import type { SubscriptionDto } from "./api";
import { apiGetSubscriptions } from "./api";
import { formatMoney } from "./format";

type Props = {
  initData: string;
};

export function CalendarPanel({ initData }: Props) {
  const [cursor, setCursor] = useState(() => new Date());
  const [subs, setSubs] = useState<SubscriptionDto[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setSubs(await apiGetSubscriptions(initData));
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Ошибка");
      }
    })();
  }, [initData]);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const byDay = useMemo(() => {
    const m = new Map<string, SubscriptionDto[]>();
    const ym = format(cursor, "yyyy-MM");
    for (const s of subs) {
      if (!s.nextChargeOn.startsWith(ym)) continue;
      const list = m.get(s.nextChargeOn) ?? [];
      list.push(s);
      m.set(s.nextChargeOn, list);
    }
    return m;
  }, [subs, cursor]);

  const weekStartPad = (monthStart.getDay() + 6) % 7;

  return (
    <div className="panel calendar">
      {err && <p className="error">{err}</p>}
      <div className="cal-nav">
        <button
          type="button"
          className="btn sm"
          onClick={() => setCursor((d) => addMonths(d, -1))}
        >
          ←
        </button>
        <span className="cal-title">
          {format(cursor, "LLLL yyyy", { locale: ru })}
        </span>
        <button
          type="button"
          className="btn sm"
          onClick={() => setCursor((d) => addMonths(d, 1))}
        >
          →
        </button>
      </div>
      <div className="cal-weekdays">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="cal-grid">
        {Array.from({ length: weekStartPad }).map((_, i) => (
          <span key={`pad-${i}`} className="cal-cell empty" />
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const list = byDay.get(key) ?? [];
          const today = isSameDay(day, new Date());
          return (
            <div
              key={key}
              className={`cal-cell ${today ? "today" : ""} ${list.length ? "has" : ""}`}
            >
              <span className="cal-day">{format(day, "d")}</span>
              {list.length > 0 && (
                <ul className="cal-dots">
                  {list.map((s) => (
                    <li key={s.id} title={`${s.name} · ${formatMoney(s.amountCents, s.currency)}`}>
                      ●
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      <p className="muted small">
        Показаны даты следующего списания по каждой подписке.
      </p>
    </div>
  );
}
