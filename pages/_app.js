// pages/_app.js
import "../style/globals.css";
import Head from "next/head";

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <link rel="icon" href="/favicon-32x32.png" sizes="32x32" />
        <link rel="icon" href="/favicon-16x16.png" sizes="16x16" />
        <link rel="apple-touch-icon" href="/logo-singging@2x.png" />
        <meta property="og:image" content="/logo-singging-social.png" />
        <meta name="theme-color" content="#0f172a" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Karaoke SingGing</title>
      </Head>

      <Component {...pageProps} />
    </>
  );
}
