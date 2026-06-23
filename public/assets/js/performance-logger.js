/**
 * Performance Logger — Phase 2 Frontend Tracking
 * 
 * Collects Web Vitals and DOM events from user sessions.
 * Batches errors and sends to /api/_perf-log every 30 seconds.
 * 
 * Usage in index.html:
 *   <script src="/assets/js/performance-logger.js" defer></script>
 * 
 * Metrics tracked:
 *   - Web Vitals: LCP, FCP, INP, CLS
 *   - DOM Events: menu-toggle, form-submit, booking-click, guide-select
 *   - Performance: page load time, navigation time
 *   - Errors: JavaScript errors, console.error calls
 */

class PerformanceLogger {
  constructor() {
    this.batchQueue = [];
    this.batchSize = 0;
    this.maxBatchSize = 10; // Max items before auto-send
    this.batchInterval = 30000; // Send every 30 seconds (ms)
    this.sessionId = this.generateSessionId();
    this.pageStart = performance.now();
    this.isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    this.init();
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  init() {
    console.log(`[PerformanceLogger] Initialized (sessionId: ${this.sessionId})`);

    // Setup Web Vitals observer
    this.setupWebVitalsObserver();

    // Setup DOM event tracking
    this.setupDOMEventTracking();

    // Setup error handling
    this.setupErrorHandling();

    // Setup batch sender
    this.setupBatchSender();

    // Log page load complete
    window.addEventListener('load', () => {
      this.logEvent('page_load', {
        duration_ms: performance.now() - this.pageStart,
        title: document.title,
        url: window.location.href,
      });
    });
  }

  /**
   * Setup Web Vitals observer (LCP, FCP, INP, CLS)
   */
  setupWebVitalsObserver() {
    // Largest Contentful Paint (LCP)
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.logEvent('web_vital_lcp', {
          value: Math.round(lastEntry.renderTime || lastEntry.loadTime),
          element: lastEntry.element?.className || 'unknown',
        });
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) {
      if (this.isDev) console.log('[PerformanceLogger] LCP observer not supported');
    }

    // First Contentful Paint (FCP) — via PerformanceObserver
    try {
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name === 'first-contentful-paint') {
            this.logEvent('web_vital_fcp', {
              value: Math.round(entry.startTime),
            });
          }
        });
      });
      fcpObserver.observe({ entryTypes: ['paint'] });
    } catch (e) {
      if (this.isDev) console.log('[PerformanceLogger] FCP observer not supported');
    }

    // Interaction to Next Paint (INP) — Experimental
    try {
      const inpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.logEvent('web_vital_inp', {
          value: Math.round(lastEntry.duration),
          interaction_type: lastEntry.interactionTarget?.className || 'unknown',
        });
      });
      inpObserver.observe({ entryTypes: ['event'] });
    } catch (e) {
      if (this.isDev) console.log('[PerformanceLogger] INP observer not supported');
    }

    // Cumulative Layout Shift (CLS)
    try {
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        let clsValue = 0;
        entries.forEach((entry) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        if (clsValue > 0) {
          this.logEvent('web_vital_cls', {
            value: clsValue.toFixed(4),
          });
        }
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (e) {
      if (this.isDev) console.log('[PerformanceLogger] CLS observer not supported');
    }
  }

  /**
   * Setup DOM event tracking for critical interactions
   */
  setupDOMEventTracking() {
    // Menu toggle
    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) {
      const originalClickHandler = menuToggle.onclick;
      menuToggle.addEventListener('click', (e) => {
        const startTime = performance.now();
        // Let the click propagate and handler execute
        setTimeout(() => {
          const duration = performance.now() - startTime;
          const isOpen = document.getElementById('header')?.classList.contains('nav-open');
          this.logEvent('dom_event_menu_toggle', {
            duration_ms: Math.round(duration),
            is_open: !!isOpen,
            slo_passed: duration < 100,
          });
        }, 10);
      });
    }

    // Booking form submit
    const bookingForm = document.getElementById('booking-form');
    if (bookingForm) {
      bookingForm.addEventListener('submit', (e) => {
        this.logEvent('dom_event_booking_submit', {
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent,
        });
      });
    }

    // Guide selection (AI Studio)
    const guideSelect = document.querySelectorAll('[data-guide-select]');
    if (guideSelect.length > 0) {
      guideSelect.forEach((el) => {
        el.addEventListener('click', () => {
          this.logEvent('dom_event_guide_select', {
            guide_name: el.getAttribute('data-guide-name') || 'unknown',
          });
        });
      });
    }

    // Booking CTA clicks
    const bookingCtas = document.querySelectorAll('a[href*="/booking"], button[data-booking]');
    if (bookingCtas.length > 0) {
      bookingCtas.forEach((el) => {
        el.addEventListener('click', () => {
          this.logEvent('dom_event_booking_cta_click', {
            source: el.getAttribute('data-source') || el.className,
          });
        });
      });
    }
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // Global error handler
    window.addEventListener('error', (e) => {
      this.logEvent('error_javascript', {
        message: e.message,
        filename: e.filename,
        line: e.lineno,
        column: e.colno,
        severity: 'HIGH',
      });
    });

    // Unhandled promise rejection
    window.addEventListener('unhandledrejection', (e) => {
      this.logEvent('error_unhandled_rejection', {
        reason: e.reason?.message || String(e.reason),
        severity: 'HIGH',
      });
    });

    // Log console.error calls
    const originalError = console.error;
    console.error = (...args) => {
      originalError.apply(console, args);
      this.logEvent('error_console_error', {
        message: args.map(String).join(' '),
        severity: 'MEDIUM',
      });
    };
  }

  /**
   * Setup batch sender (every 30 seconds or max batch size)
   */
  setupBatchSender() {
    setInterval(() => {
      if (this.batchQueue.length > 0) {
        this.sendBatch();
      }
    }, this.batchInterval);
  }

  /**
   * Log an event to the batch queue
   */
  logEvent(category, metadata = {}) {
    const event = {
      id: `event_${nanoid()}`,
      category,
      metadata: {
        ...metadata,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      },
      sessionId: this.sessionId,
    };

    this.batchQueue.push(event);

    // Auto-send if batch is full
    if (this.batchQueue.length >= this.maxBatchSize) {
      this.sendBatch();
    }

    if (this.isDev) {
      console.log(`[PerformanceLogger] Event queued: ${category}`, event);
    }
  }

  /**
   * Send batch to /api/_perf-log
   */
  async sendBatch() {
    if (this.batchQueue.length === 0) return;

    const batch = this.batchQueue.splice(0, this.maxBatchSize);
    const payload = {
      sessionId: this.sessionId,
      events: batch,
      timestamp: new Date().toISOString(),
    };

    try {
      const response = await fetch('/api/_perf-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true, // Ensure request completes even if page unloads
      });

      if (response.ok) {
        if (this.isDev) console.log(`[PerformanceLogger] Batch sent (${batch.length} events)`);
      } else {
        console.warn(`[PerformanceLogger] Batch send failed: ${response.status}`);
        // Re-queue failed batch
        this.batchQueue.unshift(...batch);
      }
    } catch (error) {
      console.warn(`[PerformanceLogger] Network error sending batch:`, error);
      // Re-queue failed batch
      this.batchQueue.unshift(...batch);
    }
  }

  /**
   * Flush remaining events on page unload
   */
  flush() {
    if (this.batchQueue.length > 0) {
      navigator.sendBeacon('/api/_perf-log', JSON.stringify({
        sessionId: this.sessionId,
        events: this.batchQueue,
        timestamp: new Date().toISOString(),
      }));
    }
  }
}

/**
 * Simple nanoid implementation (for event IDs)
 */
function nanoid() {
  return Math.random().toString(36).slice(2, 11);
}

// Initialize on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.performanceLogger = new PerformanceLogger();
  });
} else {
  window.performanceLogger = new PerformanceLogger();
}

// Flush events on page unload
window.addEventListener('beforeunload', () => {
  if (window.performanceLogger) {
    window.performanceLogger.flush();
  }
});
