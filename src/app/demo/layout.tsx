import type { ReactNode } from "react";

export const metadata = {
  title: "Demo — School2Pay",
  description: "Interactive demo of School2Pay for UK schools",
};

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Demo banner */}
      <div className="sticky top-0 z-50 bg-amber-400 text-amber-900 text-center text-sm font-semibold py-2 px-4">
        Demo mode — no real data or payments ·
        <a href="/#contact" className="underline ml-2 hover:text-amber-700">Book a free demo with our team →</a>
      </div>
      {children}
    </>
  );
}
