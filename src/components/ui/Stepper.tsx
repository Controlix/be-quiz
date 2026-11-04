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
      <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={value <= min}
          aria-label="Verlaag aantal"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-xs transition-all hover:bg-slate-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-10 text-center text-sm font-bold text-slate-900 select-none">
          {value}
        </span>
        <button
          type="button"
          onClick={handleIncrement}
          disabled={value >= max}
          aria-label="Verhoog aantal"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-xs transition-all hover:bg-slate-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
