// Converts Arabic-Indic (٠-٩) and Persian (۰-۹) digits to ASCII so numeric fields
// accept whatever keyboard the user has.
export function toEnglishDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

export const digitsOnly = (s: string, max?: number) => {
  const d = toEnglishDigits(s).replace(/[^\d]/g, "");
  return max ? d.slice(0, max) : d;
};
