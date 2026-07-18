import { ImageResponse } from "next/og";

export const runtime = "edge";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: "#2563eb",
          borderRadius: 96,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            color: "white",
            fontSize: 192,
            fontWeight: 800,
            fontFamily: "sans-serif",
            letterSpacing: "-4px",
          }}
        >
          S2P
        </span>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
