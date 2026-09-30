export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-[22px] px-11 pt-10 pb-8">{children}</div>
  );
}
