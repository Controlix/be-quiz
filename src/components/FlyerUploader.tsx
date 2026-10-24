"use client";

import { useState, useRef } from "react";
import { Upload, Camera, Loader2, AlertCircle } from "lucide-react";
import { VisionExtractionResult } from "@/services/visionService";

interface FlyerUploaderProps {
  onExtractionComplete: (result: VisionExtractionResult & { flyerImageUrl?: string }) => void;
}

export function FlyerUploader({ onExtractionComplete }: FlyerUploaderProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const resizeImageCanvas = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 1600;
        const MAX_HEIGHT = 1600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(file);

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else resolve(file);
          },
          "image/jpeg",
          0.85
        );
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setLoading(true);

    try {
      const resizedBlob = await resizeImageCanvas(file);
      const formData = new FormData();
      formData.append("file", resizedBlob, "flyer.jpg");

      const response = await fetch("/api/quizzes/extract", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Fout bij analyseren van flyer");
      }

      onExtractionComplete(data);
    } catch (err: any) {
      setError(err.message || "Kon de flyer niet verwerken.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <div
        onClick={() => !loading && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
          loading
            ? "border-blue-400 bg-blue-50/50"
            : "border-slate-200 hover:border-blue-500 hover:bg-slate-50 bg-white"
        }`}
      >
        {loading ? (
          <>
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
            <p className="text-sm font-semibold text-slate-800">Flyer analyseren met AI...</p>
            <p className="text-xs text-slate-500 mt-1">Datum, locatie en ploegmaat uitzoeken</p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <Camera className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-900">Upload flyer of maak foto</p>
            <p className="text-xs text-slate-500 mt-1">Ondersteunt JPG, PNG, WEBP (tot 4MB)</p>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 p-3 rounded-xl border border-red-200">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
