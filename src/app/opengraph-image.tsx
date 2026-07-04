// OG card for link unfurls (X, LinkedIn, Slack, Discord). Rendered with
// next/og; Instrument Serif is fetched subsetted at request time to match the
// landing wordmark.

import { ImageResponse } from "next/og";

export const alt = "EverDesk - the support agent that never forgets a customer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadGoogleFont(family: string, text: string): Promise<ArrayBuffer> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(cssUrl)).text();
  const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
  if (!url) throw new Error("font url not found");
  return await (await fetch(url)).arrayBuffer();
}

const TAG = "AI SUPPORT AGENTS WITH MEMORY";
const TAGLINE = "The support agent that never forgets a customer - and now acts for them.";
const FOOTER = "everdesk.allensaji.dev Memory by Cognee Cloud";

export default async function OgImage() {
  const wordmark = "EverDesk";
  const [instrumentSerif, geist] = await Promise.all([
    loadGoogleFont("Instrument Serif", wordmark).catch(() => null),
    loadGoogleFont("Geist", `${TAG}${TAGLINE}${FOOTER}`).catch(() => null),
  ]);
  const fonts = [
    ...(instrumentSerif
      ? [{ name: "Instrument Serif", data: instrumentSerif, style: "normal" as const, weight: 400 as const }]
      : []),
    ...(geist
      ? [{ name: "Geist", data: geist, style: "normal" as const, weight: 400 as const }]
      : []),
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          backgroundColor: "#07070d",
          backgroundImage:
            "radial-gradient(820px 480px at 18% 0%, rgba(99,102,241,0.28), transparent 65%), radial-gradient(700px 420px at 100% 100%, rgba(67,56,202,0.22), transparent 60%)",
          fontFamily: geist ? "Geist" : "sans-serif",
        }}
      >
        {/* mark + product tag */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="56" height="56" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="7" fill="#4f46e5" />
            <path
              d="M7 10.5A4.5 4.5 0 0 1 11.5 6h9A4.5 4.5 0 0 1 25 10.5v5a4.5 4.5 0 0 1-4.5 4.5h-6.2l-4 3.6c-.94.85-2.3.14-2.3-1.1V10.5Z"
              fill="#fff"
            />
            <path
              d="M12.2 15.4 16 11.2M16 11.2l3.8 3.4"
              stroke="#4f46e5"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle cx="12.2" cy="15.4" r="1.85" fill="#4f46e5" />
            <circle cx="16" cy="11.2" r="1.85" fill="#4f46e5" />
            <circle cx="19.8" cy="14.6" r="1.85" fill="#4f46e5" />
          </svg>
          <div style={{ fontSize: 26, letterSpacing: 6, color: "#818cf8" }}>
            {TAG}
          </div>
        </div>

        {/* wordmark + tagline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 148,
              lineHeight: 1,
              fontFamily: instrumentSerif ? "Instrument Serif" : "serif",
            }}
          >
            <span style={{ color: "#ffffff" }}>Ever</span>
            <span style={{ color: "#818cf8" }}>Desk</span>
          </div>
          <div
            style={{
              marginTop: 30,
              fontSize: 40,
              lineHeight: 1.35,
              color: "#94a3b8",
              maxWidth: 900,
            }}
          >
            {TAGLINE}
          </div>
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 26,
            color: "#64748b",
          }}
        >
          <div style={{ display: "flex" }}>everdesk.allensaji.dev</div>
          <div style={{ display: "flex" }}>Memory by Cognee Cloud</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fonts.length ? fonts : undefined,
    },
  );
}
