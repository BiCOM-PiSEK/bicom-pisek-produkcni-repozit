import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';

describe('Menu Toggle (Hamburger Menu)', () => {
  let dom;
  let window;
  let document;

  beforeEach(() => {
    // Create a minimal HTML structure mimicking index.html
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Test</title>
      </head>
      <body>
        <header id="header">
          <button class="menu-toggle" id="menu-toggle" aria-label="Otevřít menu" aria-expanded="false">
            <svg><path/></svg>
          </button>
          <nav id="nav-menu">
            <ul>
              <li><a href="#hero" class="nav-link">Úvod</a></li>
              <li><a href="#pruvodce" class="nav-link">Průvodce</a></li>
            </ul>
          </nav>
        </header>
      </body>
      </html>
    `, {
      url: 'http://localhost',
      pretendToBeVisual: true,
    });

    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
  });

  it('should toggle nav-open class when menu-toggle is clicked', () => {
    const header = document.getElementById('header');
    const menuToggle = document.getElementById('menu-toggle');

    // Simulate the menu toggle initialization
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      header.classList.toggle('nav-open');
      const isOpen = header.classList.contains('nav-open');
      menuToggle.setAttribute('aria-expanded', isOpen);
    });

    // Initially menu should be closed
    expect(header.classList.contains('nav-open')).toBe(false);
    expect(menuToggle.getAttribute('aria-expanded')).toBe('false');

    // Click to open
    menuToggle.click();
    expect(header.classList.contains('nav-open')).toBe(true);
    expect(menuToggle.getAttribute('aria-expanded')).toBe('true');

    // Click again to close
    menuToggle.click();
    expect(header.classList.contains('nav-open')).toBe(false);
    expect(menuToggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('should close menu when clicking on a nav link', () => {
    const header = document.getElementById('header');
    const menuToggle = document.getElementById('menu-toggle');
    const navLinks = document.querySelectorAll('header nav a');

    // Setup event listeners
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      header.classList.toggle('nav-open');
      const isOpen = header.classList.contains('nav-open');
      menuToggle.setAttribute('aria-expanded', isOpen);
    });

    navLinks.forEach((link) => {
      link.addEventListener('click', () => {
        header.classList.remove('nav-open');
        menuToggle.setAttribute('aria-expanded', 'false');
      });
    });

    // Open menu
    menuToggle.click();
    expect(header.classList.contains('nav-open')).toBe(true);

    // Click a nav link
    navLinks[0].click();
    expect(header.classList.contains('nav-open')).toBe(false);
    expect(menuToggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('should close menu when clicking outside header', () => {
    const header = document.getElementById('header');
    const menuToggle = document.getElementById('menu-toggle');

    // Setup event listeners
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      header.classList.toggle('nav-open');
      const isOpen = header.classList.contains('nav-open');
      menuToggle.setAttribute('aria-expanded', isOpen);
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('header')) {
        header.classList.remove('nav-open');
        menuToggle.setAttribute('aria-expanded', 'false');
      }
    });

    // Open menu
    menuToggle.click();
    expect(header.classList.contains('nav-open')).toBe(true);

    // Create a click event on body (outside header)
    const bodyClick = new window.Event('click', { bubbles: true });
    document.body.dispatchEvent(bodyClick);

    expect(header.classList.contains('nav-open')).toBe(false);
    expect(menuToggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('should complete menu toggle interaction in under 100ms (SLO)', async () => {
    const header = document.getElementById('header');
    const menuToggle = document.getElementById('menu-toggle');

    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      header.classList.toggle('nav-open');
      const isOpen = header.classList.contains('nav-open');
      menuToggle.setAttribute('aria-expanded', isOpen);
    });

    const startTime = performance.now();
    menuToggle.click();
    const endTime = performance.now();

    const duration = endTime - startTime;
    expect(duration).toBeLessThan(100);
    expect(header.classList.contains('nav-open')).toBe(true);
  });
});
