"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, Loader2, AlertCircle, UploadCloud } from "lucide-react";
import { VisionExtractionResult } from "@/services/visionService";

interface FlyerUploaderProps {
  onExtractionComplete: (result: VisionExtractionResult & { flyerImageUrl?: string }) => void;
}

export function FlyerUploader({ onExtractionComplete }: FlyerUploaderProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
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

  const processFile = async (file: File) => {
    setError(null);
    setLoading(true);

    try {
      let uploadPayload: Blob | File = file;
      try {
        uploadPayload = await resizeImageCanvas(file);
      } catch (resizeErr) {
        console.warn("Client-side canvas resize skipped, using original file:", resizeErr);
        uploadPayload = file;
      }

      const formData = new FormData();
      formData.append("file", uploadPayload, file.name || "flyer.jpg");

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
    // Reset input value so re-uploading the same file triggers onChange
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!loading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (loading) return;

    const file = e.dataTransfer.files?.[0];
    const isImage = file && (file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp)$/i.test(file.name));
    if (isImage) {
      await processFile(file);
    } else if (file) {
      setError("Gelieve een geldige afbeelding (JPG, PNG, WEBP) te uploaden.");
    }
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (loading) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            processFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [loading]);

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      <div
        onClick={() => !loading && inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
          loading
            ? "border-blue-400 bg-blue-50/50"
            : isDragging
            ? "border-blue-500 bg-blue-50/70 scale-[1.01]"
            : "border-slate-200 hover:border-blue-500 hover:bg-slate-50 bg-white"
        }`}
      >
        {loading ? (
          <>
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
            <p className="text-sm font-semibold text-slate-800">Flyer analyseren met AI...</p>
            <p className="text-xs text-slate-500 mt-1">Datum, locatie en ploegmaat uitzoeken</p>
          </>
        ) : isDragging ? (
          <>
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
              <UploadCloud className="w-6 h-6 animate-bounce" />
            </div>
            <p className="text-sm font-bold text-blue-700">Laat afbeelding hier los!</p>
            <p className="text-xs text-blue-500 mt-1">Screenshot of flyer wordt meteen verwerkt</p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <Camera className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-900">Upload flyer, sleep hierheen of plak screenshot</p>
            <p className="text-xs text-slate-500 mt-1">
              Sleep een bestand of plak rechtstreeks met Ctrl+V / Cmd+V
            </p>
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
