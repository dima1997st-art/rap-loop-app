import { getToken } from "next-auth/jwt";
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { documentId, text, title } = await req.json();

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

    const drive = google.drive({
      version: "v3",
      auth,
    });

    if (title && title.trim()) {
      await drive.files.update({
        fileId: documentId,
        requestBody: {
          name: title.trim(),
        },
      });
    }

    const currentDoc = await docs.documents.get({
      documentId,
    });

    const content = currentDoc.data.body?.content || [];
    const endIndex = content[content.length - 1]?.endIndex || 1;

    const requests: any[] = [];

    if (endIndex > 2) {
      requests.push({
        deleteContentRange: {
          range: {
            startIndex: 1,
            endIndex: endIndex - 1,
          },
        },
      });
    }

    if (text && text.length > 0) {
      requests.push({
        insertText: {
          location: {
            index: 1,
          },
          text,
        },
      });
    }

    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests,
        },
      });
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error("DOC UPDATE ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Update failed" },
      { status: 500 }
    );
  }
}