import { LibraryPage } from "@/app/reels/library-page";

export const dynamic = "force-dynamic";
// analysis started from this page keeps running on the server after the page is left
export const maxDuration = 300;

// Hooks is the same page as the Library, opened on its Hooks tab.
export default function HooksPage() {
  return <LibraryPage mode="hooks" />;
}
