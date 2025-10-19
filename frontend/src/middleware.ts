import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/gift/(.*)',  // Gift pages are public (recipients don't need to log in)
  '/api/gift/validate-token(.*)',
  '/api/gift/session/(.*)',
  '/api/gift/:id/trigger-handoff',
  '/api/gift/:id/recommendation',
  '/api/text-worker(.*)',
  '/api/client-secret(.*)',
  '/api/sake-recommendations(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
