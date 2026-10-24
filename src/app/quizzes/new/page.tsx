"use client";

import Link from "next/link";
import { ArrowLeft, Sparkles, Upload } from "lucide-react";

export default function NewQuizPage() {
  return (
    <div className="flex-1 flex flex-col p-4 pb-20">
      <div className="flex items-center justify-between mb-4 pt-1">
        <Link
          href="/quizzes"
          className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 text-sm font-semibold p-1 -ml-1 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Overzicht</span>
        </Link>
        <span className="text-xs text-slate-400 font-medium">Nieuwe Quiz</span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm text-center my-auto">
        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Sparkles className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900 mb-1">Flyer Scanner & Invoer</h2>
        <p className="text-xs text-slate-500 mb-4 max-w-xs mx-auto">
          Dit scherm wordt in <strong>Slice 3</strong> gekoppeld aan de camera en Vision AI om quiz flyers automatisch uit te lezen.
        </p>
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 bg-slate-50 flex flex-col items-center justify-center text-slate-400">
          <Upload className="w-8 h-8 mb-2 text-slate-300" />
          <span className="text-xs font-medium">Flyer uploaden of foto maken</span>
          <span className="text-[10px] text-slate-400 mt-1">(Komt in Slice 3)</span>
        </div>
      </div>
    </div>
  );
}
