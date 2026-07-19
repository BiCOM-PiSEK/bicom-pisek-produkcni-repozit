// functions/api/_middleware.js
// Handles dynamic CORS configuration for all API routes under /api/*

export async function onRequest(context) {
  const { request } = context;
  const origin = request.headers.get('Origin');

  // Allow same-origin (no Origin header) or specific allowed origins
  let allowedOrigin = 'https://bicom-pisek.cz';
  if (origin) {
    const isAllowed = origin === 'https://bicom-pisek.cz' ||
                      origin === 'https://www.bicom-pisek.cz' ||
                      origin.endsWith('.pages.dev') ||
                      /^http:\/\/localhost(:\d+)?$/.test(origin) ||
                      /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin);
    if (isAllowed) {
      allowedOrigin = origin;
    }
  }

  // Handle OPTIONS preflight directly
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cf-Access-Jwt-Assertion',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  const response = await context.next();

  // Add CORS headers to final response
  const newResponse = new Response(response.body, response);
  newResponse.headers.delete('Content-Encoding');
  newResponse.headers.delete('Content-Length');
  newResponse.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  newResponse.headers.set('Access-Control-Allow-Credentials', 'true');
  newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cf-Access-Jwt-Assertion');

  return newResponse;
}
