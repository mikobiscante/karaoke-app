export default function SiteHeader() {
  return (
    <header className="flex items-center gap-3 px-6 py-4 bg-background border-b border-border">
      <img
        src="/logo-singging.png"
        alt="Karaoke SingGing"
        className="h-12 w-auto"
      />
      <div className="text-foreground font-400 tracking-wide">Karaoke SingGing</div>
    </header>
  );
}