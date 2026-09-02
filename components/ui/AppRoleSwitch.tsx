"use client";

export type AppRoleSwitchValue = "me" | "partner";

export function AppRoleSwitch({
  value,
  onChange,
  meLabel = "我",
  partnerLabel = "Ta",
  ariaLabel = "切换查看对象",
}: {
  value: AppRoleSwitchValue;
  onChange: (value: AppRoleSwitchValue) => void;
  meLabel?: string;
  partnerLabel?: string;
  ariaLabel?: string;
}) {
  return (
    <div className="life-role-switch" role="group" aria-label={ariaLabel}>
      <button type="button" aria-pressed={value === "me"} onClick={() => onChange("me")}>
        {meLabel}
      </button>
      <button type="button" aria-pressed={value === "partner"} onClick={() => onChange("partner")}>
        {partnerLabel}
      </button>
    </div>
  );
}
