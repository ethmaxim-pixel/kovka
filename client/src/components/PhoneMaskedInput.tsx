import { useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";

interface PhoneMaskedInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
  placeholder?: string;
}

function formatPhone(digits: string): string {
  // digits should be only numbers, max 11 (7 + 10 digits)
  const d = digits.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 1) return "+7";
  if (d.length <= 4) return `+7 (${d.slice(1)}`;
  if (d.length <= 7) return `+7 (${d.slice(1, 4)}) ${d.slice(4)}`;
  if (d.length <= 9) return `+7 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return `+7 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9, 11)}`;
}

function extractDigits(formatted: string): string {
  return formatted.replace(/\D/g, "");
}

export default function PhoneMaskedInput({
  value,
  onChange,
  className,
  required,
  placeholder = "+7 (___) ___-__-__",
}: PhoneMaskedInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let digits = extractDigits(e.target.value);
      // Ensure starts with 7
      if (digits.length > 0 && digits[0] !== "7") {
        if (digits[0] === "8") {
          digits = "7" + digits.slice(1);
        } else {
          digits = "7" + digits;
        }
      }
      const formatted = formatPhone(digits);
      onChange(formatted);
    },
    [onChange]
  );

  const handleFocus = useCallback(() => {
    if (!value) {
      onChange("+7");
    }
  }, [value, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Prevent deleting the +7 prefix
      if (e.key === "Backspace" && extractDigits(value).length <= 1) {
        e.preventDefault();
      }
    },
    [value]
  );

  return (
    <Input
      ref={inputRef}
      type="tel"
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      className={className}
      required={required}
    />
  );
}
