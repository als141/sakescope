import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/gift/(.*)',  // Gift pages are public (recipients don't need to log in)
  '/liff/gift(.*)',
  '/api/gift/validate-token(.*)',
  '/api/gift/session/(.*)',
  '/api/gift/:id/trigger-handoff',
  '/api/gift/:id/recommendation',
  '/api/text-worker(.*)',
  '/api/embed-text-worker(.*)',
  '/api/client-secret(.*)',
  '/api/sake-recommendations(.*)',
  '/text-chat(.*)', // Text chat UI is public
  '/api/text-chatkit(.*)', // ChatKit backend for text chat is public
  '/embed(.*)',
  '/api/line/webhook(.*)',
  '/api/webhooks/clerk(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  const rewrite = handleLiffStateRewrite(request);
  if (rewrite) {
    return rewrite;
  }

  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

function handleLiffStateRewrite(request: NextRequest) {
  const url = request.nextUrl;
  const stateParam = url.searchParams.get('liff.state');

  if (!stateParam) {
    return null;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(stateParam);
  } catch {
    return null;
  }

  if (!decoded.startsWith('/')) {
    return null;
  }

  const target = new URL(decoded, url.origin);
  return NextResponse.redirect(target, { status: 307 });
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
