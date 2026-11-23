"use client";

import React from "react";
import { formatEuropeanDateString, formatEuropeanTimeString } from "@/lib/formatters";

export interface QuizMetadataFieldsProps {
  title: string;
  onTitleChange: (value: string) => void;
  date: string;
  onDateChange: (value: string) => void;
  time: string;
  onTimeChange: (value: string) => void;
  location: string;
  onLocationChange: (value: string) => void;
  organizerEmail: string;
  onOrganizerEmailChange: (value: string) => void;
  entryFeeAmount: string;
  onEntryFeeAmountChange: (value: string) => void;
  entryFeeUnit: "TEAM" | "PERSON";
  onEntryFeeUnitChange: (unit: "TEAM" | "PERSON") => void;
  missingFields?: string[];
  disabled?: boolean;
  teamSizeControl?: React.ReactNode;
}

export function QuizMetadataFields({
  title,
  onTitleChange,
  date,
  onDateChange,
  time,
  onTimeChange,
  location,
  onLocationChange,
  organizerEmail,
  onOrganizerEmailChange,
  entryFeeAmount,
  onEntryFeeAmountChange,
  entryFeeUnit,
  onEntryFeeUnitChange,
  missingFields = [],
  disabled = false,
  teamSizeControl,
}: QuizMetadataFieldsProps) {
  return (
    <>
      {/* Title */}
      <div>
        <label htmlFor="quiz-title-input" className="mb-1 block text-xs font-bold text-slate-700">
          Kwis Titel *
        </label>
        <input
          id="quiz-title-input"
          type="text"
          maxLength={100}
          disabled={disabled}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="bv. Grote Herfstquiz"
          className={`w-full rounded-xl border p-2.5 text-sm disabled:opacity-60 ${
            missingFields.includes("title") ? "border-red-500 bg-red-50/30" : "border-slate-200"
          }`}
        />
      </div>

      {/* Date & Time */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="quiz-date-input" className="mb-1 block text-xs font-bold text-slate-700">
            Datum (DD/MM/JJJJ) *
          </label>
          <input
            id="quiz-date-input"
            type="text"
            inputMode="numeric"
            maxLength={10}
            disabled={disabled}
            value={date}
            onChange={(e) => onDateChange(formatEuropeanDateString(e.target.value))}
            placeholder="DD/MM/JJJJ"
            className={`w-full rounded-xl border p-2 text-sm font-medium disabled:opacity-60 ${
              missingFields.includes("date") ? "border-red-500 bg-red-50/30" : "border-slate-200"
            }`}
          />
        </div>
        <div>
          <label htmlFor="quiz-time-input" className="mb-1 block text-xs font-bold text-slate-700">
            Aanvangsuur (24u) *
          </label>
          <input
            id="quiz-time-input"
            type="text"
            inputMode="numeric"
            maxLength={5}
            disabled={disabled}
            value={time}
            onChange={(e) => onTimeChange(formatEuropeanTimeString(e.target.value))}
            placeholder="20:00"
            className={`w-full rounded-xl border p-2 text-sm font-medium disabled:opacity-60 ${
              missingFields.includes("time") ? "border-red-500 bg-red-50/30" : "border-slate-200"
            }`}
          />
        </div>
      </div>

      {/* Location & Optional Team Size */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label
            htmlFor="quiz-location-input"
            className="mb-1 block text-xs font-bold text-slate-700"
          >
            Locatie / Zaal *
          </label>
          <input
            id="quiz-location-input"
            type="text"
            maxLength={120}
            disabled={disabled}
            value={location}
            onChange={(e) => onLocationChange(e.target.value)}
            placeholder="bv. Zaal Centrum, Gent"
            className={`w-full rounded-xl border p-2 text-sm disabled:opacity-60 ${
              missingFields.includes("location")
                ? "border-red-500 bg-red-50/30"
                : "border-slate-200"
            }`}
          />
        </div>
        {teamSizeControl}
      </div>

      {/* Contact Email & Fee */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="quiz-organizer-email-input"
            className="mb-1 block text-xs font-medium text-slate-600"
          >
            Inschrijf Email
          </label>
          <input
            id="quiz-organizer-email-input"
            type="email"
            disabled={disabled}
            value={organizerEmail}
            onChange={(e) => onOrganizerEmailChange(e.target.value)}
            placeholder="organisatie@quiz.be"
            className="w-full rounded-xl border border-slate-200 p-2.5 text-xs disabled:opacity-60"
          />
        </div>
        <div>
          <label
            htmlFor="quiz-entry-fee-input"
            className="mb-1 block text-xs font-medium text-slate-600"
          >
            Inschrijvingsgeld
          </label>
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <span className="absolute top-1/2 left-2.5 -translate-y-1/2 text-xs font-bold text-slate-400">
                €
              </span>
              <input
                id="quiz-entry-fee-input"
                type="text"
                inputMode="decimal"
                maxLength={10}
                disabled={disabled}
                value={entryFeeAmount}
                onChange={(e) => onEntryFeeAmountChange(e.target.value)}
                placeholder="20"
                className="w-full rounded-xl border border-slate-200 py-2.5 pr-2.5 pl-6 text-xs font-medium disabled:opacity-60"
              />
            </div>
            <div className="flex shrink-0 rounded-xl bg-slate-100 p-0.5 text-xs font-semibold">
              <button
                type="button"
                disabled={disabled}
                aria-pressed={entryFeeUnit === "TEAM"}
                onClick={() => onEntryFeeUnitChange("TEAM")}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] transition-all disabled:opacity-60 ${
                  entryFeeUnit === "TEAM"
                    ? "bg-white text-blue-600 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                / ploeg
              </button>
              <button
                type="button"
                disabled={disabled}
                aria-pressed={entryFeeUnit === "PERSON"}
                onClick={() => onEntryFeeUnitChange("PERSON")}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] transition-all disabled:opacity-60 ${
                  entryFeeUnit === "PERSON"
                    ? "bg-white text-blue-600 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                / persoon
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
