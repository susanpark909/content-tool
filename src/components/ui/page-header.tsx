export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div>
        <h1 className="text-[64px] leading-[0.95] font-black tracking-[-0.04em] text-foreground">
          {title}
          <span className="ml-1 inline-block size-3 rounded-full bg-[#C6FF3D] align-baseline" />
        </h1>
        {subtitle && (
          <p className="mt-2 text-[15px] font-medium text-[#4a4a48]">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}
