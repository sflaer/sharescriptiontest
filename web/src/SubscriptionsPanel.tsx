import { useEffect, useState } from "react";
import type { SubscriptionDto } from "./api";
import {
  apiConfirmPayment,
  apiDeleteSubscription,
  apiGetSubscriptions,
} from "./api";
import { formatMoney } from "./format";
import { SubscriptionEditor } from "./SubscriptionEditor";

type Props = {
  initData: string;
  onDataChange: () => void;
};

export function SubscriptionsPanel({ initData, onDataChange }: Props) {
  const [items, setItems] = useState<SubscriptionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [editor, setEditor] = useState<SubscriptionDto | "new" | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      setItems(await apiGetSubscriptions(initData));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load привязан к initData
  }, [initData]);

  if (loading && items.length === 0) {
    return <p className="muted">Загрузка…</p>;
  }

  return (
    <div className="panel">
      {err && <p className="error">{err}</p>}
      <button
        type="button"
        className="btn primary"
        onClick={() => setEditor("new")}
      >
        + Подписка
      </button>
      <ul className="sub-list">
        {items.map((s) => (
          <li key={s.id} className="sub-card">
            <div className="sub-head">
              <strong>{s.name}</strong>
              <span className="money">{formatMoney(s.amountCents, s.currency)}</span>
            </div>
            <div className="sub-meta">
              След. списание: {s.nextChargeOn} · каждые {s.intervalMonths} мес.
              {s.category && ` · ${s.category.name}`}
            </div>
            {s.paymentCard && (
              <div className="card-pill">
                <span
                  className="dot"
                  style={{ background: s.paymentCard.color }}
                />
                {s.paymentCard.name}
              </div>
            )}
            {s.slotCount != null && (
              <div className="slots">
                Слоты: {s.occupiedNames.length}/{s.slotCount}
                {s.occupiedNames.length > 0 && (
                  <span className="muted"> ({s.occupiedNames.join(", ")})</span>
                )}
              </div>
            )}
            <div className="sub-actions">
              <button
                type="button"
                className="btn sm"
                onClick={() => setEditor(s)}
              >
                Изменить
              </button>
              <button
                type="button"
                className="btn sm"
                onClick={async () => {
                  try {
                    await apiConfirmPayment(initData, s.id);
                    await load();
                    onDataChange();
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : "Ошибка");
                  }
                }}
              >
                Оплачено
              </button>
              <button
                type="button"
                className="btn sm danger"
                onClick={async () => {
                  if (!confirm("Удалить подписку?")) return;
                  try {
                    await apiDeleteSubscription(initData, s.id);
                    await load();
                    onDataChange();
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : "Ошибка");
                  }
                }}
              >
                Удалить
              </button>
            </div>
          </li>
        ))}
      </ul>
      {items.length === 0 && !loading && (
        <p className="muted">Подписок пока нет.</p>
      )}
      {editor && (
        <SubscriptionEditor
          initData={initData}
          initial={editor === "new" ? null : editor}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            setEditor(null);
            await load();
            onDataChange();
          }}
        />
      )}
    </div>
  );
}
