import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Clock } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export default function TimeInput({ value, onChange, placeholder = "HH:MM" }: Props) {
  const [display, setDisplay] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const formatTime = (raw: string): string => {
    // Strip non-digits
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  };

  const validate = (formatted: string): boolean => {
    if (!formatted) return true;
    const match = formatted.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return false;
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    return h >= 0 && h <= 23 && m >= 0 && m <= 59;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatTime(e.target.value);
    setDisplay(formatted);
    if (validate(formatted)) {
      onChange(formatted);
    }
  };

  const handleBlur = () => {
    if (display && !validate(display)) {
      setDisplay(value);
    }
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="pr-9"
        maxLength={5}
      />
      <Clock className="absolute right-2.5 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
    </div>
  );
}
