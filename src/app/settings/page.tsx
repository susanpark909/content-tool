import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/ui/page-shell";
import { SettingsClient } from "./settings-client";
import { SettingsTabs } from "./settings-tabs";
import { GoalsTab } from "./goals-tab";
import { InstructionsTab } from "./instructions-tab";
import { FoundationTab } from "./foundation-tab";

export const dynamic = "force-dynamic";

const PROFILE_ID = "00000000-0000-0000-0000-000000000001";
const GOALS_ID = "00000000-0000-0000-0000-000000000001";

export default async function SettingsPage() {
  const supabase = await createClient();

  const [{ data: brand }, { data: goals }, { data: pending }, { data: instructionRows }, { data: foundation }] = await Promise.all([
    supabase
      .from("ct_brand_profile")
      .select("raw_text, headline, about, voice, known_for, story_beats")
      .eq("id", PROFILE_ID)
      .single(),
    supabase
      .from("ct_goals")
      .select("follower_goal, current_followers, revenue_goal, current_revenue, posting_goal, goal_date, ideal_client_notes, ideal_client_name, ideal_client, ideal_client_tags, ideal_client_pain_points, ideal_client_desires, ideal_client_topics")
      .eq("id", GOALS_ID)
      .single(),
    supabase.from("ct_brand_profile_pending").select("id, content, source_entry_id").order("created_at"),
    supabase.from("ct_instructions").select("id, title, used_for, body").order("created_at", { ascending: false }),
    supabase
      .from("ct_brand_foundation")
      .select("good_at, love_learning, people_need, people_pay, overlap, journey, for_against")
      .eq("id", "00000000-0000-0000-0000-000000000001")
      .maybeSingle(),
  ]);

  return (
    <PageShell>
      <div>
        <h1 className="text-[64px] leading-[0.95] font-black tracking-[-0.04em]">
          Settings
          <span className="ml-1 inline-block size-3 rounded-full bg-[#C6FF3D] align-baseline" />
        </h1>
        <p className="mt-2 text-[15px] font-medium text-[#4a4a48]">You, and who you&apos;re talking to.</p>
      </div>

      <SettingsTabs
        profile={
      <SettingsClient
        pendingNotes={(pending ?? []).map((p) => ({ id: p.id, content: p.content, sourceEntryId: p.source_entry_id }))}
        brand={{
          rawText: brand?.raw_text ?? "",
          headline: brand?.headline ?? "",
          about: brand?.about ?? "",
          voice: brand?.voice ?? [],
          knownFor: brand?.known_for ?? [],
          storyBeats: brand?.story_beats ?? [],
        }}
        idealClient={{
          rawText: goals?.ideal_client_notes ?? "",
          name: goals?.ideal_client_name ?? "",
          about: goals?.ideal_client ?? "",
          tags: (goals?.ideal_client_tags ?? "").split(",").map((t: string) => t.trim()).filter(Boolean),
          painPoints: goals?.ideal_client_pain_points ?? [],
          desires: goals?.ideal_client_desires ?? [],
          topics: goals?.ideal_client_topics ?? [],
        }}
      />
        }
        foundation={
          <FoundationTab
            initial={{
              goodAt: foundation?.good_at ?? "",
              loveLearning: foundation?.love_learning ?? "",
              peopleNeed: foundation?.people_need ?? "",
              peoplePay: foundation?.people_pay ?? "",
              overlap: foundation?.overlap ?? "",
              journey: foundation?.journey ?? "",
              forAgainst: foundation?.for_against ?? "",
            }}
          />
        }
        goals={
          <GoalsTab
            initial={{
              followerGoal: goals?.follower_goal ?? null,
              currentFollowers: goals?.current_followers ?? null,
              revenueGoal: goals?.revenue_goal ?? null,
              currentRevenue: goals?.current_revenue ?? null,
              postingGoal: goals?.posting_goal ?? null,
              goalDate: goals?.goal_date ?? null,
            }}
          />
        }
        instructions={
          <InstructionsTab
            initial={(instructionRows ?? []).map((r) => ({
              id: r.id as string,
              title: (r.title as string) ?? "",
              usedFor: (r.used_for as string) ?? "other",
              body: (r.body as string) ?? "",
            }))}
          />
        }
      />
    </PageShell>
  );
}
