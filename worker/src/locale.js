// Cloudflare supplies country metadata; no IP, location permission, or database is needed.
export function localeResponse(req) {
  const country = req.cf?.country;
  const known = /^[A-Z]{2}$/.test(country || "") && country !== "XX";
  return new Response(JSON.stringify({ language: known ? (country === "KR" ? "ko" : "en") : null }), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store", "CDN-Cache-Control": "no-store" },
  });
}
