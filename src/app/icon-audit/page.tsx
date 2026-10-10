import { PageShell } from "@/components/ui/page-shell";
import { MaterialIcon } from "@/components/ui/material-icon";

// Preview-only sheet: every icon the app uses today, by category, with other options to pick from.
type Row = { label: string; where: string; current: string[]; options: string[] };
type Group = { title: string; rows: Row[] };

const GROUPS: Group[] = [
  {
    title: "Sidebar",
    rows: [
      { label: "Home", where: "Sidebar", current: ["home"], options: ["home", "dashboard", "grid_view"] },
      { label: "Ideas", where: "Sidebar, Idea tab", current: ["lightbulb"], options: ["lightbulb", "tips_and_updates", "emoji_objects"] },
      { label: "Analyze", where: "Sidebar", current: ["query_stats"], options: ["query_stats", "analytics", "insights", "bolt"] },
      { label: "Creators", where: "Sidebar, creator pages", current: ["groups"], options: ["groups", "person_search", "group", "diversity_3"] },
      { label: "Library", where: "Sidebar", current: ["video_library"], options: ["video_library", "library_books", "collections_bookmark", "stacks"] },
      { label: "Boards", where: "Sidebar", current: ["dashboard"], options: ["dashboard", "view_kanban", "bookmarks", "folder"] },
      { label: "Scripts", where: "Sidebar, Script tab, Draft status", current: ["edit_note"], options: ["edit_note", "description", "article", "history_edu", "draw"] },
      { label: "Hook Vault", where: "Sidebar, Hook tab, Hook blocks", current: ["phishing"], options: ["phishing", "webhook", "anchor", "vpn_key", "lock"] },
      { label: "Calendar", where: "Sidebar", current: ["calendar_month"], options: ["calendar_month", "event", "date_range", "today"] },
      { label: "Settings", where: "Sidebar", current: ["settings"], options: ["settings", "tune", "manage_accounts"] },
    ],
  },
  {
    title: "Numbers on a reel",
    rows: [
      { label: "Views", where: "Library, creator pages, hooks, reel card", current: ["visibility"], options: ["visibility", "play_circle", "ondemand_video", "trending_up"] },
      { label: "Likes", where: "Library, reel card", current: ["favorite"], options: ["favorite", "thumb_up", "heart_plus"] },
      { label: "Comments", where: "Library, reel card, hooks", current: ["chat_bubble"], options: ["chat_bubble", "comment", "forum", "mode_comment"] },
      { label: "Shares (paper plane)", where: "Library, reel card, hooks", current: ["send"], options: ["send", "share", "ios_share", "outbound"] },
      { label: "Reposts", where: "Library, reel card, hooks", current: ["repeat"], options: ["repeat", "autorenew", "cached", "sync"] },
      { label: "Saves", where: "Library, reel card, hooks", current: ["bookmark"], options: ["bookmark", "bookmark_add", "turned_in", "star"] },
      { label: "Engagement rate", where: "Library, creator pages, reel card", current: ["forum"], options: ["forum", "percent", "pie_chart", "ssid_chart"] },
      { label: "Share rate", where: "Library, creator pages, reel card (same icon as Reposts today)", current: ["repeat"], options: ["repeat", "percent", "moving", "share"] },
      { label: "Outlier score", where: "Creator pages", current: ["trending_up"], options: ["trending_up", "rocket_launch", "local_fire_department", "military_tech", "bolt"] },
      { label: "Length", where: "Library, reel card, scripts", current: ["schedule"], options: ["schedule", "timer", "hourglass_empty", "av_timer"] },
      { label: "Transcript", where: "Library, reel card", current: ["graphic_eq"], options: ["graphic_eq", "subtitles", "notes", "mic", "record_voice_over"] },
    ],
  },
  {
    title: "Dates",
    rows: [
      { label: "Date posted / scheduled", where: "Hooks, attach window, calendar, scripts", current: ["event", "calendar_today"], options: ["event", "calendar_today", "calendar_month", "today"] },
      { label: "Created", where: "Script details", current: ["add_circle"], options: ["add_circle", "fiber_new", "history", "post_add"] },
      { label: "Last edited", where: "Script details", current: ["edit_calendar"], options: ["edit_calendar", "update", "history", "edit"] },
    ],
  },
  {
    title: "Status",
    rows: [
      { label: "Draft", where: "Scripts tabs and board column (same icon as Scripts)", current: ["edit_note"], options: ["edit_note", "draft", "ink_pen", "pending"] },
      { label: "Scripted", where: "Scripts tabs and board column", current: ["description"], options: ["description", "task", "article", "assignment"] },
      { label: "Scheduled", where: "Scripts tabs and board column", current: ["event"], options: ["event", "schedule_send", "alarm", "event_upcoming"] },
      { label: "Posted", where: "Scripts tabs and board column", current: ["check_circle"], options: ["check_circle", "task_alt", "published_with_changes", "verified"] },
      { label: "Status (picker)", where: "Script details", current: ["pending_actions"], options: ["pending_actions", "flag", "toggle_on", "tune"] },
      { label: "Analyzed", where: "Creator pages", current: ["check_circle"], options: ["check_circle", "query_stats", "verified", "done_all"] },
      { label: "Scanned (not analyzed yet)", where: "Creator pages", current: ["radar"], options: ["radar", "travel_explore", "visibility", "hourglass_top"] },
    ],
  },
  {
    title: "Format, reel and goal",
    rows: [
      { label: "Reel (format)", where: "Scripts, board cards, details", current: ["smart_display"], options: ["smart_display", "movie", "slideshow", "videocam", "play_circle"] },
      { label: "Carousel (format)", where: "Scripts, board cards, details", current: ["view_carousel"], options: ["view_carousel", "collections", "photo_library", "view_array"] },
      { label: "A reel is picked for a script", where: "Board cards (movie), list (smart_display)", current: ["movie", "smart_display"], options: ["movie", "smart_display", "link", "attach_file", "push_pin"] },
      { label: "Goal", where: "Filters, scripts, details", current: ["flag"], options: ["flag", "target", "ads_click", "emoji_events", "track_changes"] },
      { label: "Creator", where: "Filters", current: ["person"], options: ["person", "account_circle", "badge", "face"] },
      { label: "Exclude creator", where: "Filters", current: ["person_off"], options: ["person_off", "block", "visibility_off", "person_remove"] },
    ],
  },
  {
    title: "Actions",
    rows: [
      { label: "Add", where: "Everywhere", current: ["add", "add_circle"], options: ["add", "add_circle", "add_box", "library_add"] },
      { label: "Delete", where: "Everywhere", current: ["delete"], options: ["delete", "delete_forever", "close", "remove_circle"] },
      { label: "Rename / edit", where: "Menus", current: ["edit"], options: ["edit", "edit_square", "drive_file_rename_outline", "border_color"] },
      { label: "Move", where: "Menus", current: ["arrow_forward", "arrow_back"], options: ["arrow_forward", "drive_file_move", "open_with", "swap_horiz"] },
      { label: "Analyze (action button)", where: "Analyze, creator pages", current: ["bolt"], options: ["bolt", "query_stats", "auto_awesome", "science"] },
      { label: "Copy", where: "Script", current: ["content_copy"], options: ["content_copy", "file_copy", "copy_all"] },
      { label: "Open on Instagram", where: "Reel card, creators", current: ["open_in_new"], options: ["open_in_new", "arrow_outward", "launch", "link"] },
      { label: "Search", where: "Filters", current: ["search"], options: ["search", "manage_search", "travel_explore"] },
      { label: "Sort", where: "Filters", current: ["swap_vert"], options: ["swap_vert", "sort", "filter_list", "unfold_more"] },
      { label: "Clear filters", where: "Filters", current: ["filter_alt_off"], options: ["filter_alt_off", "filter_list_off", "restart_alt", "close"] },
      { label: "Column (board)", where: "Scripts", current: ["view_column"], options: ["view_column", "view_kanban", "splitscreen", "table_rows"] },
      { label: "Board / list switch", where: "Scripts", current: ["view_kanban", "view_list"], options: ["view_kanban", "view_list", "grid_view", "table_chart"] },
      { label: "AI edit (coming)", where: "Script", current: ["auto_awesome"], options: ["auto_awesome", "magic_button", "smart_toy", "stylus_note"] },
    ],
  },
];

export default function IconAuditPage() {
  let n = 0;
  return (
    <PageShell>
      <div>
        <h1 className="text-[34px] leading-[0.95] font-black tracking-[-0.04em] md:text-[64px]">
          Icon Sheet
          <span className="ml-1 inline-block size-2 rounded-full bg-[#C6FF3D] align-baseline md:size-3" />
        </h1>
        <p className="mt-1 text-[13.5px] font-medium text-[#4a4a48] md:mt-2 md:text-[15px]">
          Every icon in use, by category, with other options. Tell me the letter you like for each, like &quot;Hook Vault: B&quot;.
        </p>
      </div>

      {GROUPS.map((g) => (
        <div key={g.title} className="flex flex-col gap-3">
          <span className="text-[20px] font-black tracking-[-0.02em] md:text-[26px]">{g.title}</span>
          <div className="flex flex-col overflow-hidden rounded-lg border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
            {g.rows.map((r) => {
              n += 1;
              return (
                <div key={r.label} className="flex flex-col gap-3 border-b border-[#F0F0F1] px-4 py-3.5 last:border-b-0 md:flex-row md:items-center md:gap-6 md:px-5">
                  <div className="flex min-w-0 flex-col md:w-[260px] md:flex-none">
                    <span className="text-[15px] font-extrabold">
                      <span className="mr-2 text-[12px] font-bold text-[#9a9a98]">{n}</span>
                      {r.label}
                    </span>
                    <span className="text-[12px] font-medium text-[#6b6b69]">{r.where}</span>
                  </div>
                  <div className="flex flex-none flex-col items-center gap-1 md:w-[120px]">
                    <div className="flex gap-1">
                      {r.current.map((c) => (
                        <span key={c} className="flex size-11 items-center justify-center rounded-lg bg-[#0D0D0D] text-white">
                          <MaterialIcon name={c} size={24} />
                        </span>
                      ))}
                    </div>
                    <span className="text-[10.5px] font-bold tracking-wide text-[#6b6b69] uppercase">Today</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {r.options.map((o, i) => (
                      <div key={o} className="flex w-[78px] flex-col items-center gap-1 rounded-lg border border-[#E4E4E2] px-1 py-2">
                        <MaterialIcon name={o} size={26} />
                        <span className="text-[11px] font-extrabold text-[#FF1F8F]">{String.fromCharCode(65 + i)}</span>
                        <span className="w-full truncate text-center text-[9.5px] font-semibold text-[#6b6b69]" title={o}>
                          {o}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </PageShell>
  );
}
