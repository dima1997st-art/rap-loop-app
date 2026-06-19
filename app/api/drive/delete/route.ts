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

    const { fileId } = await req.json();

    if (!fileId) {
      return NextResponse.json({ error: "Missing fileId" }, { status: 400 });
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({
      access_token: token.accessToken as string,
    });

    const drive = google.drive({
      version: "v3",
      auth,
    });

    await drive.files.update({
      fileId,
      requestBody: {
        trashed: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DRIVE DELETE ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Could not delete file" },
      { status: 500 }
    );
  }
}