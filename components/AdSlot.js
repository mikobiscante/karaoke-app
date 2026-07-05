// components/AdSlot.js
import { useEffect, useRef } from "react";

/**
 * Props:
 * - client: AdSense client id (ca-pub-...)
 * - slot: ad unit id (string)
 * - style: inline style object
 * - className: optional
 * - responsive: boolean (default true)
 */
export default function AdSlot({ client, slot, style = {}, className = "", responsive = true }) {
  const insRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.adsbygoogle = window.adsbygoogle || [];
    try {
      // Request ad for this slot
      window.adsbygoogle.push({});
    } catch (e) {
      // dev or blocked environment; ignore
      // console.warn("adsbygoogle push failed", e);
    }
  }, []);

  return (
    <ins
      ref={insRef}
      className={`adsbygoogle ${className}`}
      style={style}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format={responsive ? "auto" : "rectangle"}
      data-full-width-responsive={responsive ? "true" : "false"}
    />
  );
}
