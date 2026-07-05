// components/SiteHeader.js
export default function SiteHeader() {
  return (
    <header className="flex items-center gap-3 px-6 py-4">
      <img
        src="/logo-singging.png"
        alt="Karaoke SingGing"
        className="h-12 w-auto drop-shadow-[0_8px_30px_rgba(124,58,237,0.35)]"
      />
      <div className="text-white font-extrabold tracking-wide">Karaoke SingGing</div>
    </header>
  );
}
