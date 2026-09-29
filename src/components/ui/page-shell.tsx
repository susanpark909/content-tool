export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-5 px-11 pt-8 pb-8">{children}</div>
  );
}
