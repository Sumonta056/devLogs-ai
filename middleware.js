// Vercel Routing Middleware (works without Next.js).
// Only /personal-guide/* is behind HTTP Basic Auth; every other route is public.
// Set REPORTS_USER and REPORTS_PASS in Vercel → Project → Settings → Environment Variables.

export const config = {
  matcher: ['/personal-guide', '/personal-guide/:path*'],
};

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default function middleware(request) {
  const header = request.headers.get('authorization') || '';
  const [scheme, encoded] = header.split(' ');

  if (scheme === 'Basic' && encoded) {
    const decoded = atob(encoded);
    const i = decoded.indexOf(':');
    const user = decoded.slice(0, i);
    const pass = decoded.slice(i + 1);
    if (safeEqual(user, process.env.REPORTS_USER) && safeEqual(pass, process.env.REPORTS_PASS)) {
      return; // authorised → continue to the static file
    }
  }

  return new Response('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Personal guide", charset="UTF-8"' },
  });
}
