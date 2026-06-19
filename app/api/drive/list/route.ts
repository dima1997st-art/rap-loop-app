import { getToken } from "next-auth/jwt";
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const auth = new google.auth.OAuth2();

    auth.setCredentials({
      access_token: token.accessToken as string,
    });

    const drive = google.drive({
      version: "v3",
      auth,
    });

    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.document' and trashed=false",
      fields: "files(id,name,webViewLink,modifiedTime,trashed)",
      orderBy: "modifiedTime desc",
      pageSize: 50,
    });

    return NextResponse.json(response.data.files || []);
  } catch (error: any) {
    console.error("DRIVE LIST ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Could not load docs" },
      { status: 500 }
    );
  }
}