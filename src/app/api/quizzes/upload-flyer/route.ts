import { NextRequest, NextResponse } from "next/server";
import { saveUploadedFlyer } from "@/features/vision";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Geen bestand ontvangen" }, { status: 400 });
    }

    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Afbeelding is te groot (maximum 4MB toegestaan)." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const allowedMimes = ["image/jpeg", "image/png", "image/webp"];

    let mimeType = file.type;
    if (!allowedMimes.includes(mimeType)) {
      if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        mimeType = "image/jpeg";
      } else if (
        buffer.length >= 4 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      ) {
        mimeType = "image/png";
      } else if (
        buffer.length >= 12 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP"
      ) {
        mimeType = "image/webp";
      } else {
        return NextResponse.json(
          { error: "Ongeldig bestandsformaat. Enkel JPG, PNG of WEBP toegestaan." },
          { status: 400 }
        );
      }
    }

    const flyerImageUrl = await saveUploadedFlyer(buffer, mimeType);

    return NextResponse.json({
      flyerImageUrl,
    });
  } catch (err: any) {
    console.error("Flyer upload error:", err);
    return NextResponse.json(
      { error: "Serverfout bij het opslaan van de afbeelding." },
      { status: 500 }
    );
  }
}
