import { useEffect } from "react";
import "./App.css";

export default function App() {
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    tg?.ready();
    tg?.expand();
  }, []);

  return (
    <main className="app">
      <h1>Sharescription</h1>
      <p className="muted">Менеджер подписок — скоро здесь.</p>
    </main>
  );
}
