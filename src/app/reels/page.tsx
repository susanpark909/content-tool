import { LibraryPage } from "./library-page";

export const dynamic = "force-dynamic";
// analysis started from this page keeps running on the server after the page is left
export const maxDuration = 60;

export default function AllReelsPage() {
  return <LibraryPage mode="posts" />;
}
