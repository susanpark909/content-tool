import { redirect } from "next/navigation";

// Analyze lives at the top of the Library now; old links and bookmarks land there.
export default function ResearchPage() {
  redirect("/reels");
}
