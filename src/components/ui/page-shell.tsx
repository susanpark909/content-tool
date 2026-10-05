export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-4 px-2.5 pt-3.5 pb-6 md:gap-[22px] md:px-11 md:pt-10 md:pb-8">{children}</div>
  );
}
