import { profileIconGroups, profileIconLabel } from "@/pages/app/permissions/profileIconCatalog";

interface ProfileIconPickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function ProfileIconPicker({ value, onChange, disabled = false }: ProfileIconPickerProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-background-200 bg-background-50 p-3">
      {profileIconGroups.map((group) => (
        <div key={group.id} className="flex flex-col gap-1.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-400">{group.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {group.options.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  title={option.label}
                  aria-label={option.label}
                  aria-pressed={active}
                  disabled={disabled}
                  onClick={() => onChange(option.value)}
                  className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-base transition-colors ${
                    disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                  } ${
                    active
                      ? "border-primary-500 bg-primary-100 text-primary-700 shadow-sm shadow-primary-600/20"
                      : "border-background-300 bg-background-50 text-foreground-600 hover:border-primary-300 hover:bg-background-100 hover:text-foreground-900"
                  }`}
                >
                  <i className={option.value}></i>
                  {active && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary-600 text-[9px] text-background-50">
                      <i className="ri-check-line"></i>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="flex items-center gap-1.5 border-t border-background-200 pt-2 text-[11px] text-foreground-500">
        <i className={`${value} text-sm text-primary-700`}></i>
        <span className="truncate">Selecionado: {profileIconLabel(value)}</span>
      </p>
    </div>
  );
}