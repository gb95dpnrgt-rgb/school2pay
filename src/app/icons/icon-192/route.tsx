import { ImageResponse } from "next/og";

export const runtime = "edge";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 192,
          height: 192,
          background: "#2563eb",
          borderRadius: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            color: "white",
            fontSize: 72,
            fontWeight: 800,
            fontFamily: "sans-serif",
            letterSpacing: "-2px",
          }}
        >
          S2P
        </span>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
