import { NextRequest, NextResponse } from "next/server";
import { saveUploadedFlyer } from "@/lib/storage";
import { extractQuizDetailsFromImage } from "@/services/visionService";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Geen bestand ontvangen" }, { status: 400 });
    }

    const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedMimes.includes(file.type)) {
      return NextResponse.json(
        { error: "Ongeldig bestandsformaat. Enkel JPG, PNG of WEBP toegestaan." },
        { status: 400 }
      );
    }

    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Afbeelding is te groot (maximum 4MB toegestaan)." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const flyerImageUrl = await saveUploadedFlyer(buffer, file.type);
    const extraction = await extractQuizDetailsFromImage(buffer, file.type);

    return NextResponse.json({
      flyerImageUrl,
      ...extraction,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Serverfout bij het verwerken van de afbeelding." },
      { status: 500 }
    );
  }
}
