import React from "react";
import { createRoot } from "react-dom/client";
import { GoalioApp } from "@/features/app/GoalioApp";
import { PersonalizationSettings } from "@/features/personalization/PersonalizationSettings";
import { HELLO_KITTY_BACKGROUNDS, usePersonalization } from "@/features/personalization/usePersonalization";
import { createInitialState, type ScreenName } from "@/lib/storage/schema";
import { cents } from "@/lib/domain/money";
import "@/app/globals.css";

// Isolated marketing origin, with demonstration data and no account or cloud connection.
localStorage.setItem("goalio:appearance:v1", JSON.stringify({theme:"pink",background:null,blocks:HELLO_KITTY_BACKGROUNDS}));
const view = new URLSearchParams(location.search).get("view") ?? "daily-balance";
const initial = createInitialState();
function AppearancePreview() {
  const settings = usePersonalization();
  return <div className="app-shell" data-theme={settings.theme}><main className="screen"><PersonalizationSettings settings={settings}/></main></div>;
}
createRoot(document.getElementById("root")!).render(view === "personalization" ? <AppearancePreview/> : <GoalioApp initialState={{
  ...initial, screen: view as ScreenName, onboarded: true, balance: cents(680000),
  plan: {...initial.plan, income:{amount:cents(250000),cadence:"monthly",nextDate:"2026-10-01"},dailyFood:cents(3500),goal:{name:"国庆",amount:cents(80000),deadline:"2026-10-01"}},
  lastResult:{date:"2026-09-06",balance:cents(680000),effectiveSaved:cents(3100)},
  purchase: {name:"降噪耳机",amount:cents(89900)},
}} onStateChange={() => {}}/>);
