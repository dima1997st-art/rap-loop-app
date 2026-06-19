import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { word, context } = await req.json();

    if (!word) {
      return NextResponse.json(
        { error: "Missing word" },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({
  model: "gemini-3-flash-preview",
});

    const prompt = `
You are a rap rhyme assistant.

Word:
${word}

Context:
${context || ""}

Return ONLY valid JSON.

Example:
{
  "rhymes": ["...", "..."]
}

Rules:
- exactly 10 rhymes
- can be slant rhymes
- creative
- short
- rap style
- Ukrainian, English, slang allowed
`;

    const result = await model.generateContent(prompt);

    const text = result.response.text();

    const cleaned = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    return NextResponse.json({
      rhymes: parsed.rhymes || [],
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        error: error?.message || "Gemini failed",
      },
      { status: 500 }
    );
  }
}