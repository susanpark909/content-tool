export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-7 px-11 pt-10 pb-12">{children}</div>
  );
}
