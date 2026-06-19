# Project Notes

## App idea
AI-powered writing workstation for lyrics / rap / music writing.

## Current stack
- Next.js App Router
- TypeScript
- Tailwind CSS
- NextAuth
- Google Docs API
- Google Drive API
- WaveSurfer.js
- web-audio-beat-detector
- Gemini API

## Current features
- Apple-style minimal UI
- Beat upload / replace
- Waveform visualization
- Draggable loop region
- Play full beat
- Play selected loop
- Pause / stop
- Waveform zoom
- BPM detection
- Lyrics editor
- Local autosave
- Download project as `.txt`
- New Project flow
- Google login
- Google Docs integration
- Google Drive docs list
- Create linked Google Doc
- Open Google Doc inside app
- Live sync lyrics to Google Docs
- Live sync project title to Google Docs
- Delete Google Docs from app
- AI rhyme assistant:
  - select word
  - right click
  - get 10 rhymes
  - More 10
  - click rhyme to insert

## Main files
- `app/page.tsx`
- `app/api/auth/[...nextauth]/route.ts`
- `app/api/drive/list/route.ts`
- `app/api/drive/delete/route.ts`
- `app/api/docs/create/route.ts`
- `app/api/docs/read/route.ts`
- `app/api/docs/update/route.ts`
- `app/api/ai/rhymes/route.ts`
- `app/providers.tsx`
- `app/layout.tsx`
- `next-auth.d.ts`
- `.env.local`

## Env variables
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `GEMINI_API_KEY`

## Next ideas
- Better AI rhyme UI
- AI line rewrite
- AI continue verse
- Save beat metadata with project
- Multiple local projects
- Cloud database
- Authenticated user projects
- Better mobile layout
- Keyboard shortcuts
- Metronome
- Recording vocals
- Key detection