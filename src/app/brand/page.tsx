import { createClient } from "@/lib/supabase/server";
import { BrandProfileForm } from "./brand-profile-form";

export const dynamic = "force-dynamic";

export default async function BrandProfilePage() {
  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from("ct_brand_profile")
    .select(
      "voice_tone, phrases_to_use, phrases_to_avoid, audience, content_pillars, personal_stories, opinions_povs, strong_opinion_wedge, offers_products, examples_like_susan, examples_hates, updated_at",
    )
    .single();

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-destructive">
          Couldn&apos;t load your Brand Profile: {error?.message}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Brand Profile</h1>
        <p className="text-sm text-muted-foreground">
          What makes generated content sound like you, not generic AI. Used as
          primary context when the Script Writer writes for you.
        </p>
      </div>

      <BrandProfileForm
        initial={{
          voiceTone: profile.voice_tone ?? "",
          phrasesToUse: profile.phrases_to_use ?? "",
          phrasesToAvoid: profile.phrases_to_avoid ?? "",
          audience: profile.audience ?? "",
          contentPillars: profile.content_pillars ?? "",
          personalStories: profile.personal_stories ?? "",
          opinionsPovs: profile.opinions_povs ?? "",
          strongOpinionWedge: profile.strong_opinion_wedge ?? "",
          offersProducts: profile.offers_products ?? "",
          examplesLikeSusan: profile.examples_like_susan ?? "",
          examplesHates: profile.examples_hates ?? "",
        }}
      />
    </div>
  );
}
