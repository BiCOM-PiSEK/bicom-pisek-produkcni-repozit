import { describe, it, expect, vi } from 'vitest';
import { onRequest } from '../functions/admin/_middleware.js';

describe('Admin Authentication Middleware', () => {
  it('should handle POST /admin/login with correct password and set cookie', async () => {
    const request = new Request('https://bicom-pisek.cz/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password: 'Bicom-@26' }),
      headers: { 'Content-Type': 'application/json' }
    });
    const env = {
      SECRET_ADMIN_PASSWORD: 'Bicom-@26',
      SECRET_SESSION_KEY: 'test-salt'
    };
    const next = vi.fn();
    const data = {};

    const response = await onRequest({ request, env, next, data });
    expect(response.status).toBe(200);
    
    const body = await response.json();
    expect(body.ok).toBe(true);
    
    const setCookie = response.headers.get('Set-Cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('admin_session=');
    expect(setCookie).toContain('Path=/admin');
    expect(setCookie).toContain('HttpOnly');
  });

  it('should handle POST /admin/login with incorrect password and return 401', async () => {
    const request = new Request('https://bicom-pisek.cz/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password: 'wrong-password' }),
      headers: { 'Content-Type': 'application/json' }
    });
    const env = {
      SECRET_ADMIN_PASSWORD: 'Bicom-@26',
      SECRET_SESSION_KEY: 'test-salt'
    };
    const next = vi.fn();
    const data = {};

    const response = await onRequest({ request, env, next, data });
    expect(response.status).toBe(401);
    
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('Nesprávné heslo.');
  });

  it('should handle GET /admin/logout and clear cookie', async () => {
    const request = new Request('https://bicom-pisek.cz/admin/logout', {
      method: 'GET'
    });
    const env = {};
    const next = vi.fn();
    const data = {};

    const response = await onRequest({ request, env, next, data });
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/admin/login');
    
    const setCookie = response.headers.get('Set-Cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('admin_session=;');
    expect(setCookie).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  });

  it('should skip auth checks for static assets and login page', async () => {
    const request = new Request('https://bicom-pisek.cz/admin/css/admin.css');
    const env = {};
    const next = vi.fn().mockResolvedValue(new Response('css-file'));
    const data = {};

    const response = await onRequest({ request, env, next, data });
    expect(next).toHaveBeenCalled();
    const text = await response.text();
    expect(text).toBe('css-file');
  });

  it('should redirect HTML page requests to login page if session is missing', async () => {
    const request = new Request('https://bicom-pisek.cz/admin/bookings', {
      headers: { 'Accept': 'text/html' }
    });
    const env = {};
    const next = vi.fn();
    const data = {};

    const response = await onRequest({ request, env, next, data });
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('/admin/login?redirect_url=');
  });

  it('should return 401 JSON error for API requests if session is missing', async () => {
    const request = new Request('https://bicom-pisek.cz/admin/activity', {
      headers: { 'Accept': 'application/json' }
    });
    const env = {};
    const next = vi.fn();
    const data = {};

    const response = await onRequest({ request, env, next, data });
    expect(response.status).toBe(401);
    
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain('Neoprávněný přístup');
  });

  it('should allow access and set operator data if session is valid', async () => {
    const secret = 'test-salt';
    const expires = Date.now() + 100000;
    const payload = `${expires}`;
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payload)
    );
    const signatureHex = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const validToken = `${payload}.${signatureHex}`;

    const request = new Request('https://bicom-pisek.cz/admin/activity', {
      headers: { 
        'Accept': 'application/json',
        'Cookie': `admin_session=${validToken}`
      }
    });
    
    const env = {
      SECRET_SESSION_KEY: secret,
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => ({
              id: 'op_admin_box',
              email: 'admin@bicom-pisek.cz',
              name: 'Admin',
              role: 'admin'
            })
          })
        })
      }
    };
    const next = vi.fn().mockResolvedValue(new Response('authorized'));
    const data = {};

    const response = await onRequest({ request, env, next, data });
    expect(next).toHaveBeenCalled();
    expect(data.operator).toBeDefined();
    expect(data.operator.role).toBe('admin');
    
    const text = await response.text();
    expect(text).toBe('authorized');
  });

  it('should rewrite /admin/kalendar to /admin/ via env.ASSETS.fetch with X-SPA-Fallback header', async () => {
    const secret = 'test-salt';
    const expires = Date.now() + 100000;
    const payload = `${expires}`;
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payload)
    );
    const signatureHex = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const validToken = `${payload}.${signatureHex}`;

    const request = new Request('https://bicom-pisek.cz/admin/kalendar', {
      headers: { 
        'Accept': 'text/html',
        'Cookie': `admin_session=${validToken}`
      }
    });

    const mockFetch = vi.fn().mockImplementation((req) => {
      expect(req.url).toBe('https://bicom-pisek.cz/admin/');
      expect(req.headers.get('X-SPA-Fallback')).toBe('true');
      return new Response('index-html-content');
    });
    const env = {
      SECRET_SESSION_KEY: secret,
      ASSETS: {
        fetch: mockFetch
      }
    };
    const next = vi.fn();
    const data = {};

    const response = await onRequest({ request, env, next, data });
    expect(mockFetch).toHaveBeenCalled();
    const text = await response.text();
    expect(text).toBe('index-html-content');
    expect(next).not.toHaveBeenCalled();
  });

  it('should not rewrite /admin/index.html or when X-SPA-Fallback is present', async () => {
    const secret = 'test-salt';
    const expires = Date.now() + 100000;
    const payload = `${expires}`;
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payload)
    );
    const signatureHex = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const validToken = `${payload}.${signatureHex}`;

    // Test 1: /admin/index.html
    const request1 = new Request('https://bicom-pisek.cz/admin/index.html', {
      headers: { 
        'Accept': 'text/html',
        'Cookie': `admin_session=${validToken}`
      }
    });

    const mockFetch = vi.fn();
    const env = {
      SECRET_SESSION_KEY: secret,
      ASSETS: {
        fetch: mockFetch
      }
    };
    const next1 = vi.fn().mockResolvedValue(new Response('next-index-html'));
    const data1 = {};

    const response1 = await onRequest({ request: request1, env, next: next1, data: data1 });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(next1).toHaveBeenCalled();
    const text1 = await response1.text();
    expect(text1).toBe('next-index-html');

    // Test 2: X-SPA-Fallback is present on `/admin/kalendar`
    const request2 = new Request('https://bicom-pisek.cz/admin/kalendar', {
      headers: { 
        'Accept': 'text/html',
        'Cookie': `admin_session=${validToken}`,
        'X-SPA-Fallback': 'true'
      }
    });
    const next2 = vi.fn().mockResolvedValue(new Response('next-fallback-bypass'));
    const data2 = {};

    const response2 = await onRequest({ request: request2, env, next: next2, data: data2 });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(next2).toHaveBeenCalled();
    const text2 = await response2.text();
    expect(text2).toBe('next-fallback-bypass');
  });
});
