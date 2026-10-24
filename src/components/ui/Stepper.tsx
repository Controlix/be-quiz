"use client";

import React from "react";
import { Minus, Plus } from "lucide-react";

export interface StepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  label?: string;
  className?: string;
}

export function Stepper({
  value,
  min = 1,
  max = 10,
  onChange,
  label,
  className = "",
}: StepperProps) {
  const handleDecrement = (e: React.MouseEvent) => {
    e.preventDefault();
    if (value > min) {
      onChange(value - 1);
    }
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.preventDefault();
    if (value < max) {
      onChange(value + 1);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && <span className="text-xs font-bold text-slate-700">{label}</span>}
      <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 p-1">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={value <= min}
          aria-label="Verlaag aantal"
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs active:scale-95 transition-all"
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="w-10 text-center font-bold text-sm text-slate-900 select-none">
          {value}
        </span>
        <button
          type="button"
          onClick={handleIncrement}
          disabled={value >= max}
          aria-label="Verhoog aantal"
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
