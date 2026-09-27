import { SettingsTabs } from "./settings-tabs";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <div className="px-4 pt-6 sm:px-8">
        <h1 className="text-2xl font-semibold">Settings</h1>
      </div>
      <SettingsTabs />
      {children}
    </div>
  );
}
