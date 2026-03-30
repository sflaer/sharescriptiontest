import { useEffect, useState } from "react";
import { apiGetMe, type Me } from "./api";
import { CalendarPanel } from "./CalendarPanel";
import { SettingsPanel } from "./SettingsPanel";
import { SubscriptionsPanel } from "./SubscriptionsPanel";
import "./App.css";

type Tab = "subs" | "cal" | "settings";

export default function App() {
  const [tab, setTab] = useState<Tab>("subs");
  const [initData, setInitData] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    tg?.ready();
    tg?.expand();
    const raw = tg?.initData ?? "";
    setInitData(raw || null);
  }, []);

  useEffect(() => {
    if (!initData) {
      setLoading(false);
      return;
    }
    void (async () => {
      setErr(null);
      try {
        setMe(await apiGetMe(initData));
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Ошибка API");
      } finally {
        setLoading(false);
      }
    })();
  }, [initData]);

  if (!initData) {
    return (
      <main className="shell">
        <p className="error">
          Откройте приложение из Telegram (кнопка или меню бота).
        </p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="shell">
        <p className="muted">Загрузка…</p>
      </main>
    );
  }

  if (err || !me) {
    return (
      <main className="shell">
        <p className="error">{err ?? "Нет данных"}</p>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="top">
        <h1>Sharescription</h1>
        <p className="muted small">Менеджер подписок</p>
      </header>

      <nav className="tabs">
        <button
          type="button"
          className={tab === "subs" ? "active" : ""}
          onClick={() => setTab("subs")}
        >
          Подписки
        </button>
        <button
          type="button"
          className={tab === "cal" ? "active" : ""}
          onClick={() => setTab("cal")}
        >
          Календарь
        </button>
        <button
          type="button"
          className={tab === "settings" ? "active" : ""}
          onClick={() => setTab("settings")}
        >
          Настройки
        </button>
      </nav>

      {tab === "subs" && (
        <SubscriptionsPanel initData={initData} onDataChange={() => {}} />
      )}
      {tab === "cal" && <CalendarPanel initData={initData} />}
      {tab === "settings" && (
        <SettingsPanel
          initData={initData}
          me={me}
          onMeUpdated={(m) => setMe(m)}
        />
      )}
    </main>
  );
}
