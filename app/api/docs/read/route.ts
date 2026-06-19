import { getToken } from "next-auth/jwt";
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

function normalizeDocText(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u000b\u000c\u0085\u2028\u2029]/g, "\n")
    .replace(/[\u0000-\u0008\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractTextFromGoogleDoc(doc: any) {
  const content = doc.body?.content || [];
  let text = "";

  for (const block of content) {
    const paragraph = block.paragraph;
    if (!paragraph) continue;

    for (const element of paragraph.elements || []) {
      const value = element.textRun?.content;
      if (value) text += value;
    }
  }

  return normalizeDocText(text);
}

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { documentId } = await req.json();

    if (!documentId) {
      return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({
      access_token: token.accessToken as string,
    });

    const docs = google.docs({
      version: "v1",
      auth,
    });

    const response = await docs.documents.get({
      documentId,
    });

    return NextResponse.json({
      title: response.data.title || "Untitled Project",
      text: extractTextFromGoogleDoc(response.data),
    });
  } catch (error: any) {
    console.error("DOC READ ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Read failed" },
      { status: 500 }
    );
  }
}
