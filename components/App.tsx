"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Monitor, Settings2 } from "lucide-react";
import { useAppState } from "@/lib/store";
import { themeCss } from "@/lib/theme";
import TV from "./TV";
import Admin from "./admin/Admin";

type View = "tv" | "admin";

/** Renders the TV or Admin view; without `view` (the root URL) it forwards to the configured start view. */
export default function App({ view }: { view?: View }) {
  const state = useAppState();
  const router = useRouter();

  useEffect(() => {
    if (!state || view) return;
    // old #tv / #admin links still work
    const h = window.location.hash.replace("#", "");
    router.replace(h === "tv" || h === "admin" ? `/${h}` : `/${state.settings.startView}`);
  }, [state, view, router]);

  if (!state || !view) return null;
  const dark = view === "tv" && state.settings.tvTheme === "dark";

  return (
    <>
      <style>{`:root{${themeCss(state.settings.palette, dark)}}`}</style>
      {view === "tv" ? <TV state={state} /> : <Admin state={state} openTv={() => window.open("/tv", "_blank")} />}
      <div className={`switcher ${view === "tv" ? "hide" : ""}`}>
        <button className={view === "tv" ? "on" : ""} onClick={() => router.push("/tv")}>
          <Monitor size={16} strokeWidth={2.75} /> TV
        </button>
        <button className={view === "admin" ? "on" : ""} onClick={() => router.push("/admin")}>
          <Settings2 size={16} strokeWidth={2.75} /> Admin
        </button>
      </div>
    </>
  );
}
