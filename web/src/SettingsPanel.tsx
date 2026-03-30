import { useEffect, useState } from "react";
import {
  apiCreateCard,
  apiCreateCategory,
  apiDeleteCategory,
  apiGetCards,
  apiGetCategories,
  apiPatchMe,
} from "./api";
import type { Me } from "./api";

const COMMON_TZ = [
  "Europe/Moscow",
  "Europe/Kaliningrad",
  "Asia/Yekaterinburg",
  "Asia/Novosibirsk",
  "UTC",
];

type Props = {
  initData: string;
  me: Me;
  onMeUpdated: (m: Me) => void;
};

export function SettingsPanel({ initData, me, onMeUpdated }: Props) {
  const [tz, setTz] = useState(me.timezone);
  const [catName, setCatName] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardColor, setCardColor] = useState("#3390ec");
  const [custom, setCustom] = useState<{ id: string; name: string }[]>([]);
  const [cards, setCards] = useState<{ id: string; name: string; color: string }[]>(
    [],
  );
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadLists() {
    const [c, cr] = await Promise.all([
      apiGetCategories(initData),
      apiGetCards(initData),
    ]);
    setCustom(c.custom);
    setCards(cr);
  }

  useEffect(() => {
    void loadLists().catch((e) =>
      setErr(e instanceof Error ? e.message : "Ошибка"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initData]);

  useEffect(() => {
    setTz(me.timezone);
  }, [me.timezone]);

  async function saveTz() {
    setBusy(true);
    setErr(null);
    try {
      const m = await apiPatchMe(initData, { timezone: tz });
      onMeUpdated(m);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!catName.trim()) return;
    setErr(null);
    try {
      await apiCreateCategory(initData, catName.trim());
      setCatName("");
      await loadLists();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function addCard(e: React.FormEvent) {
    e.preventDefault();
    if (!cardName.trim()) return;
    setErr(null);
    try {
      await apiCreateCard(initData, { name: cardName.trim(), color: cardColor });
      setCardName("");
      await loadLists();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    }
  }

  return (
    <div className="panel settings">
      {err && <p className="error">{err}</p>}

      <section className="block">
        <h3>Часовой пояс</h3>
        <p className="muted small">
          Для напоминаний и «сегодня». По умолчанию можно взять из устройства:{" "}
          <button
            type="button"
            className="link"
            onClick={() =>
              setTz(Intl.DateTimeFormat().resolvedOptions().timeZone)
            }
          >
            {Intl.DateTimeFormat().resolvedOptions().timeZone}
          </button>
        </p>
        <label>
          IANA
          <input
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            placeholder="Europe/Moscow"
            list="tz-presets"
          />
          <datalist id="tz-presets">
            {COMMON_TZ.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
        </label>
        <button
          type="button"
          className="btn primary"
          disabled={busy}
          onClick={() => void saveTz()}
        >
          Сохранить часовой пояс
        </button>
      </section>

      <section className="block">
        <h3>Свои категории</h3>
        <form onSubmit={addCategory} className="row">
          <input
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            placeholder="Название"
          />
          <button type="submit" className="btn">
            Добавить
          </button>
        </form>
        <ul className="mini-list">
          {custom.map((c) => (
            <li key={c.id}>
              {c.name}
              <button
                type="button"
                className="link danger"
                onClick={async () => {
                  if (!confirm("Удалить категорию?")) return;
                  await apiDeleteCategory(initData, c.id);
                  await loadLists();
                }}
              >
                удалить
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="block">
        <h3>Карты оплаты (название + цвет)</h3>
        <form onSubmit={addCard} className="card-add">
          <input
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
            placeholder="Название"
          />
          <input
            type="color"
            value={cardColor}
            onChange={(e) => setCardColor(e.target.value)}
            aria-label="Цвет"
          />
          <button type="submit" className="btn">
            Добавить карту
          </button>
        </form>
        <ul className="mini-list">
          {cards.map((c) => (
            <li key={c.id}>
              <span className="dot" style={{ background: c.color }} />
              {c.name}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
