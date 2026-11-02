interface PlatformSwitchProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

/** Interruptor acessível reutilizado pelos painéis de parametrização e permissões. */
export default function PlatformSwitch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: PlatformSwitchProps) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-background-200 bg-background-50 px-3.5 py-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground-900">{label}</p>
        {description && <p className="mt-0.5 text-[11px] leading-relaxed text-foreground-500">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
        } ${checked ? "bg-primary-500" : "bg-background-300"}`}
      >
        <span
          className={`absolute h-[18px] w-[18px] rounded-full bg-background-50 transition-transform ${
            checked ? "translate-x-[23px]" : "translate-x-[4px]"
          }`}
        ></span>
      </button>
    </div>
  );
}