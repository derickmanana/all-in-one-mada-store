import { type ReactNode } from "react";

export interface Tab {
  id: string;
  label: string;
  icon: ReactNode;
}

export function TabNav({
  tabs,
  active,
  onChange,
}: {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <nav className="sticky bottom-0 z-20 -mx-6 mt-8 border-t border-border bg-card/95 backdrop-blur md:static md:mx-0 md:mt-0 md:mb-6 md:rounded-2xl md:border md:bg-card">
      <div className="flex justify-around md:justify-start md:gap-2 md:p-2">
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={`flex flex-1 flex-col items-center gap-1 px-3 py-3 text-[11px] font-bold transition-colors md:flex-none md:flex-row md:gap-2 md:rounded-xl md:px-4 md:py-2 md:text-sm ${
                isActive
                  ? "text-mada-red md:bg-mada-red md:text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="text-lg md:text-base">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
