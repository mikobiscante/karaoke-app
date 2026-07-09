// pages/_app.js
import "../style/globals.css";
import Head from "next/head";
import Script from "next/script";

// in a component or _app.js (client-side)
import { useEffect } from "react";
import { initAuth, initAnalytics } from "../utils/firebase";
import { logEvent } from "firebase/analytics";

export default function MyApp({ Component, pageProps }) {
  useEffect(() => {
    let mounted = true;
    initAuth(); // returns auth instance or null
    initAnalytics().then((analytics) => {
      if (!mounted || !analytics) return;
      logEvent(analytics, "analytics_initialized");
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      <Head>
        <link rel="icon" href="/favicon-32x32.png" sizes="32x32" />
        <link rel="icon" href="/favicon-16x16.png" sizes="16x16" />
        <link rel="apple-touch-icon" href="/logo-singging@2x.png" />
        <meta property="og:image" content="/logo-singging-social.png" />
        <meta name="theme-color" content="#0a0a0f" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Karaoke SingGing</title>
      </Head>

      {/* AdSense script loads after hydration */}
      <Script
        id="adsense"
        strategy="afterInteractive"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "ca-pub-8539359990744350"}`}
        crossOrigin="anonymous"
      />

      <Component {...pageProps} />
    </>
  );
}
