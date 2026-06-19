import { getToken } from "next-auth/jwt";
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

function normalizeDocText(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u000b\u000c\u0085\u2028\u2029]/g, "\n")
    .replace(/[\u0000-\u0008\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t]+\n/g, "\n");
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

    const { title, text } = await req.json();
    const normalizedText = typeof text === "string" ? normalizeDocText(text) : "";

    const auth = new google.auth.OAuth2();
    auth.setCredentials({
      access_token: token.accessToken as string,
    });

    const docs = google.docs({
      version: "v1",
      auth,
    });

    const created = await docs.documents.create({
      requestBody: {
        title: title?.trim() || "Untitled Project",
      },
    });

    const documentId = created.data.documentId;

    if (!documentId) {
      return NextResponse.json(
        { error: "No documentId returned" },
        { status: 500 }
      );
    }

    if (normalizedText.trim()) {
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: {
                  index: 1,
                },
                text: normalizedText,
              },
            },
          ],
        },
      });
    }

    return NextResponse.json({
      documentId,
      title: created.data.title,
      url: `https://docs.google.com/document/d/${documentId}/edit`,
    });
  } catch (error: any) {
    console.error("DOC CREATE ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Create failed" },
      { status: 500 }
    );
  }
}
