"use client";

import { useState, useTransition } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";
import { connectStripe, disconnectProvider, syncNow, type ConnectionState } from "./connections-actions";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "not yet");

function Card({ icon, title, blurb, children }: { icon: string; title: string; blurb: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[#F0F0F1] bg-white p-4 shadow-[0_4px_16px_rgba(13,13,13,0.07)] md:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-11 flex-none items-center justify-center rounded-lg bg-[#FFF0F7] text-[#FF1F8F]">
          <MaterialIcon name={icon} size={24} weight={500} />
        </span>
        <div className="min-w-0">
          <div className="text-[19px] font-black tracking-[-0.02em]">{title}</div>
          <p className="text-[13.5px] font-medium text-[#4a4a48] max-md:text-[15px]">{blurb}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

const BTN = "flex h-11 items-center justify-center gap-2 rounded-md px-4 text-[14px] font-extrabold max-md:h-12 max-md:text-[16px]";
const PRIMARY = `${BTN} bg-[#FF1F8F] text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F] disabled:opacity-60`;
const SECONDARY = `${BTN} border border-[#E4E4E2] bg-white hover:border-[#0D0D0D]`;

export function ConnectionsTab({ connections, instagramReady, notice }: { connections: ConnectionState[]; instagramReady: boolean; notice?: string }) {
  const [pending, startTransition] = useTransition();
  const [key, setKey] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const ig = connections.find((c) => c.provider === "instagram");
  const stripe = connections.find((c) => c.provider === "stripe");

  const run = (fn: () => Promise<unknown>) => {
    setErr(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  };

  return (
    <div className="flex flex-col gap-[22px] max-md:gap-4">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <span className="h-[22px] w-1 rounded-[2px] bg-[#FF1F8F]" />
          <span className="text-xl font-black tracking-[-0.025em] md:text-2xl">Connections</span>
        </div>
        <p className="max-w-[78ch] text-[13.5px] font-medium text-[#4a4a48] max-md:text-[15px]">
          Plug in where your numbers live. They feed My Performance and the Followers and Revenue progress on your Home page.
        </p>
      </div>
      {notice && <p className="text-[14px] font-semibold text-[#D10A6E]">{notice}</p>}
      {err && <p className="text-[14px] font-semibold text-[#D10A6E]">{err}</p>}

      <Card icon="photo_camera" title="Instagram" blurb="Your own reels, straight from Instagram: views, shares, saves, how long people watch, and which reels got you followers.">
        {ig && ig.status !== "disconnected" ? (
          <div className="flex flex-col gap-2.5">
            <p className="text-[14px] font-semibold max-md:text-[16px]">
              Connected{ig.accountName ? ` as ${ig.accountName}` : ""}. Last updated {when(ig.lastSyncAt)}.
            </p>
            {ig.error && <p className="text-[13.5px] font-semibold text-[#D10A6E]">{ig.error}</p>}
            <div className="flex flex-wrap gap-2.5">
              <button type="button" disabled={pending} onClick={() => run(() => syncNow())} className={PRIMARY}>
                <MaterialIcon name="sync" size={18} weight={500} /> {pending ? "Updating…" : "Update Now"}
              </button>
              <button type="button" disabled={pending} onClick={() => run(() => disconnectProvider("instagram"))} className={SECONDARY}>
                Disconnect
              </button>
            </div>
          </div>
        ) : instagramReady ? (
          <a href="/api/instagram/connect" className={`${PRIMARY} w-fit`}>
            <MaterialIcon name="link" size={18} weight={500} /> Connect Instagram
          </a>
        ) : (
          <p className="rounded-md bg-[#F6F6F5] p-3 text-[13.5px] font-medium text-[#4a4a48] max-md:text-[15px]">
            Almost ready. This needs a one-time setup with Meta (Instagram&apos;s owner) and an Instagram Business or Creator account. Once you have the account, this button turns on.
          </p>
        )}
      </Card>

      <Card icon="payments" title="Stripe" blurb="Your sales and revenue. Use a read-only key: it can look at payments but can never move money.">
        {stripe && stripe.status !== "disconnected" ? (
          <div className="flex flex-col gap-2.5">
            <p className="text-[14px] font-semibold max-md:text-[16px]">Connected. Last updated {when(stripe.lastSyncAt)}.</p>
            {stripe.error && <p className="text-[13.5px] font-semibold text-[#D10A6E]">{stripe.error}</p>}
            <div className="flex flex-wrap gap-2.5">
              <button type="button" disabled={pending} onClick={() => run(() => syncNow())} className={PRIMARY}>
                <MaterialIcon name="sync" size={18} weight={500} /> {pending ? "Updating…" : "Update Now"}
              </button>
              <button type="button" disabled={pending} onClick={() => run(() => disconnectProvider("stripe"))} className={SECONDARY}>
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <input
              type="password"
              data-own-size
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Paste your restricted key (starts with rk_live_)"
              autoComplete="off"
              className="h-11 w-full rounded-md border border-[#E4E4E2] bg-white px-3 text-[14px] font-medium outline-none focus:border-[#0D0D0D] max-md:h-12 max-md:text-[16px]"
            />
            <p className="text-[12.5px] font-medium text-[#6b6b69] max-md:text-[14px]">In Stripe: Developers, API keys, Create restricted key. Give it Read access to Charges only.</p>
            <button
              type="button"
              disabled={pending || !key.trim()}
              onClick={() =>
                run(async () => {
                  const r = await connectStripe(key);
                  if (!r.ok) throw new Error(r.error);
                  setKey("");
                })
              }
              className={`${PRIMARY} w-fit`}
            >
              {pending ? "Checking…" : "Connect Stripe"}
            </button>
          </div>
        )}
      </Card>

      {[
        { icon: "storefront", title: "Stan Store", blurb: "Sales from your Stan store." },
        { icon: "school", title: "Skool", blurb: "Memberships and sales from your Skool community." },
      ].map((c) => (
        <Card key={c.title} icon={c.icon} title={c.title} blurb={c.blurb}>
          <p className="rounded-md bg-[#F6F6F5] p-3 text-[13.5px] font-medium text-[#6b6b69] max-md:text-[15px]">
            Coming next. They don&apos;t offer a direct connection yet, so this will import your sales another way.
          </p>
        </Card>
      ))}
    </div>
  );
}
