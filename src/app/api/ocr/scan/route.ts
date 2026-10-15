import { NextRequest, NextResponse } from "next/server";
import { parseVisitingCardText, type ExtractedCardData } from "@/lib/visitingCardOcr";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image } = body;

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // 1. Check for Gemini Vision API Key
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (geminiKey) {
      try {
        const mimeMatch = image.match(/^data:([^;]+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
        const base64Data = image.replace(/^data:[^;]+;base64,/, "");

        const prompt = `You are an expert OCR and data extraction system for Indian wholesale business visiting cards.
Analyze this visiting card image and extract:
1. shopName: The business / firm / store name (e.g. "THE LEGEND COLLECTION").
2. contactPerson: The person / proprietor / partner name (e.g. "DIVYARAJSINH INDRAJITSINH").
3. phoneNumber: The mobile number(s) (10 digits, e.g. "7041913601" or "7041913601 / 7874969298").
4. gstPanNo: The GSTIN or PAN if printed (otherwise "").
5. address: The shop / delivery address (street, complex, temple, market).
6. city: The city or town (e.g. "Limbdi", "Surat", "Ahmedabad").
7. state: The Indian state (e.g. "Gujarat", "Maharashtra", "Rajasthan").
8. transportName: Transport or dispatch courier name if printed (otherwise "").

Return ONLY a valid JSON object matching this schema:
{
  "shopName": string,
  "contactPerson": string,
  "phoneNumber": string,
  "gstPanNo": string,
  "address": string,
  "city": string,
  "state": string,
  "transportName": string
}`;

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: prompt },
                    {
                      inlineData: {
                        mimeType,
                        data: base64Data,
                      },
                    },
                  ],
                },
              ],
              generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.1,
              },
            }),
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const textResponse =
            geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (textResponse) {
            const parsedJson = JSON.parse(textResponse);
            const cardData: ExtractedCardData = {
              shopName: parsedJson.shopName || "",
              contactPerson: parsedJson.contactPerson || "",
              phoneNumber: parsedJson.phoneNumber || "",
              gstPanNo: parsedJson.gstPanNo || "",
              address: parsedJson.address || "",
              city: parsedJson.city || "",
              state: parsedJson.state || "Gujarat",
              transportName: parsedJson.transportName || "",
              rawText: textResponse,
            };
            return NextResponse.json({ success: true, engine: "gemini", data: cardData });
          }
        }
      } catch (geminiErr) {
        console.warn("Gemini Vision attempt failed, falling back to OCR.space:", geminiErr);
      }
    }

    // 2. High-Accuracy OCR.Space Engine 2
    try {
      const ocrFormData = new URLSearchParams();
      ocrFormData.append("apikey", "helloworld");
      ocrFormData.append("base64Image", image);
      ocrFormData.append("language", "eng");
      ocrFormData.append("OCREngine", "2"); // Engine 2 is optimized for reading multi-font business cards & scene text
      ocrFormData.append("detectOrientation", "true");
      ocrFormData.append("scale", "true");

      const ocrRes = await fetch("https://api.ocr.space/parse/image", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: ocrFormData.toString(),
      });

      if (ocrRes.ok) {
        const ocrJson = await ocrRes.json();
        const rawText = ocrJson?.ParsedResults?.[0]?.ParsedText;
        if (rawText && rawText.trim().length > 0) {
          const cardData = parseVisitingCardText(rawText);
          return NextResponse.json({ success: true, engine: "ocr_space", data: cardData });
        }
      }
    } catch (ocrErr) {
      console.warn("OCR.space attempt failed:", ocrErr);
    }

    // If both server attempts failed, let client run fallback parser
    return NextResponse.json({ error: "Server OCR unavailable, use client fallback" }, { status: 503 });
  } catch (error: any) {
    console.error("OCR Scan API error:", error);
    return NextResponse.json({ error: "Failed to scan card: " + error.message }, { status: 500 });
  }
}
