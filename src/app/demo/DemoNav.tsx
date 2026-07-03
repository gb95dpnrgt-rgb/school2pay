import Link from "next/link";

export default function DemoNav({ active }: { active: "dashboard" | "requests" | "students" }) {
  const links = [
    { href: "/demo/dashboard", label: "Dashboard", key: "dashboard" },
    { href: "/demo/requests", label: "Requests", key: "requests" },
    { href: "/demo/students", label: "Students", key: "students" },
  ] as const;

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-xs">S2</span>
          </div>
          <span className="font-bold text-gray-900">School2Pay</span>
        </div>
        <div className="flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.key}
              href={l.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                active === l.key
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400">Oakwood Primary School</span>
        <a
          href="/#contact"
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
        >
          Book a real demo
        </a>
      </div>
    </nav>
  );
}
