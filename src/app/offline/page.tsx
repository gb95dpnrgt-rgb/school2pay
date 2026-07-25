"use client";

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full rounded-xl border border-gray-200 bg-white p-8 text-center space-y-4">
        <div className="text-4xl">📶</div>
        <h1 className="text-xl font-bold text-gray-900">You&apos;re offline</h1>
        <p className="text-sm text-gray-500">
          School2Pay needs an internet connection. Please check your connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
