// pages/_app.js
import "../style/globals.css"; // <- matches your project folder "style/globals.css"

export default function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
