import { LibraryPage } from "@/app/reels/library-page";

export const dynamic = "force-dynamic";
// analysis started from this page keeps running on the server after the page is left
export const maxDuration = 300;

// Notes is the same page as the Library, opened on its Notes tab.
export default function NotesPage() {
  return <LibraryPage mode="notes" />;
}
