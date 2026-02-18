import { useState, useCallback, useMemo } from "react";

export type PeriodPreset = "1d" | "7d" | "30d" | "all" | "custom";

export interface PeriodRange {
  dateFrom: Date;
  dateTo: Date;
  preset: PeriodPreset;
}

interface PeriodSelectorProps {
  defaultPreset?: PeriodPreset;
  onChange: (range: PeriodRange) => void;
}

function calcRange(preset: Exclude<PeriodPreset, "custom">): { dateFrom: Date; dateTo: Date } {
  const now = new Date();
  const dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const dateFrom = new Date(dateTo);
  if (preset === "1d") {
    dateFrom.setHours(0, 0, 0, 0);
  } else if (preset === "7d") {
    dateFrom.setDate(dateFrom.getDate() - 6);
    dateFrom.setHours(0, 0, 0, 0);
  } else if (preset === "all") {
    dateFrom.setFullYear(2020, 0, 1);
    dateFrom.setHours(0, 0, 0, 0);
  } else {
    dateFrom.setDate(dateFrom.getDate() - 29);
    dateFrom.setHours(0, 0, 0, 0);
  }
  return { dateFrom, dateTo };
}

function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function usePeriod(defaultPreset: PeriodPreset = "30d") {
  const initial = useMemo(() => {
    if (defaultPreset === "custom") {
      const r = calcRange("30d");
      return { ...r, preset: "custom" as PeriodPreset };
    }
    return { ...calcRange(defaultPreset), preset: defaultPreset };
  }, []);

  const [range, setRange] = useState<PeriodRange>(initial);

  const handleChange = useCallback((r: PeriodRange) => {
    setRange(r);
  }, []);

  return { range, handleChange };
}

export default function PeriodSelector({ defaultPreset = "30d", onChange }: PeriodSelectorProps) {
  const [active, setActive] = useState<PeriodPreset>(defaultPreset);
  const [customFrom, setCustomFrom] = useState(() => toInputDate(calcRange("30d").dateFrom));
  const [customTo, setCustomTo] = useState(() => toInputDate(new Date()));
  const [showCustom, setShowCustom] = useState(defaultPreset === "custom");

  const presets: { key: Exclude<PeriodPreset, "custom">; label: string }[] = [
    { key: "1d", label: "1д" },
    { key: "7d", label: "7д" },
    { key: "30d", label: "30д" },
    { key: "all", label: "Всё время" },
  ];

  const handlePreset = (preset: Exclude<PeriodPreset, "custom">) => {
    setActive(preset);
    setShowCustom(false);
    const r = calcRange(preset);
    onChange({ ...r, preset });
  };

  const handleCustomToggle = () => {
    setActive("custom");
    setShowCustom(true);
    const from = new Date(customFrom + "T00:00:00");
    const to = new Date(customTo + "T23:59:59.999");
    onChange({ dateFrom: from, dateTo: to, preset: "custom" });
  };

  const handleCustomChange = (type: "from" | "to", value: string) => {
    if (type === "from") {
      setCustomFrom(value);
      const from = new Date(value + "T00:00:00");
      const to = new Date(customTo + "T23:59:59.999");
      if (!isNaN(from.getTime())) onChange({ dateFrom: from, dateTo: to, preset: "custom" });
    } else {
      setCustomTo(value);
      const from = new Date(customFrom + "T00:00:00");
      const to = new Date(value + "T23:59:59.999");
      if (!isNaN(to.getTime())) onChange({ dateFrom: from, dateTo: to, preset: "custom" });
    }
  };

  return (
    <div className="period-selector">
      <div className="period-pills">
        {presets.map((p) => (
          <button
            key={p.key}
            className={`period-pill ${active === p.key ? "active" : ""}`}
            onClick={() => handlePreset(p.key)}
          >
            {p.label}
          </button>
        ))}
        <button
          className={`period-pill ${active === "custom" ? "active" : ""}`}
          onClick={handleCustomToggle}
        >
          Период
        </button>
      </div>
      {showCustom && (
        <div className="period-custom">
          <input
            type="date"
            className="period-date"
            value={customFrom}
            onChange={(e) => handleCustomChange("from", e.target.value)}
          />
          <span className="period-dash">—</span>
          <input
            type="date"
            className="period-date"
            value={customTo}
            onChange={(e) => handleCustomChange("to", e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
