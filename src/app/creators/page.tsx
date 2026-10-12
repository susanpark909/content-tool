import { LibraryPage } from "@/app/reels/library-page";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Creators is the same page as the Library, opened on its Creators tab.
export default function CreatorsPage() {
  return <LibraryPage mode="creators" />;
}
