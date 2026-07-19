import { describe, it, expect, vi, beforeEach } from 'vitest';
import cronGdpr from '../functions/api/_cron-gdpr.js';

describe('GDPR Cron Anonymization', () => {
  let mockDB;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDB = {
      prepare: vi.fn(),
    };
  });

  it('should skip anonymization if gdpr_anonymizer_status is not active', async () => {
    const mockFirst = vi.fn().mockResolvedValue(null);
    mockDB.prepare.mockReturnValue({
      first: mockFirst,
    });

    const env = { DB: mockDB };
    const event = {};
    const ctx = {};

    await cronGdpr.scheduled(event, env, ctx);

    expect(mockDB.prepare).toHaveBeenCalledWith(
      "SELECT value FROM process_states WHERE key = 'gdpr_anonymizer_status'"
    );
    expect(mockFirst).toHaveBeenCalled();
    // No update should be prepared because we returned early
    expect(mockDB.prepare).toHaveBeenCalledTimes(1);
  });

  it('should perform anonymization and write audit log when bookings are changed', async () => {
    // 1. Mock status check to return 'active'
    const mockFirst = vi.fn().mockResolvedValue({ value: 'active' });
    
    // 2. Mock update result to return 3 changes
    const mockUpdateRun = vi.fn().mockResolvedValue({
      meta: { changes: 3 }
    });
    const mockUpdateBind = vi.fn().mockReturnValue({
      run: mockUpdateRun
    });

    // 3. Mock audit log insert
    const mockAuditRun = vi.fn().mockResolvedValue({});
    const mockAuditBind = vi.fn().mockReturnValue({
      run: mockAuditRun
    });

    // Setup sequence of prepares
    mockDB.prepare.mockImplementation((sql) => {
      if (sql.includes('SELECT value FROM process_states')) {
        return { first: mockFirst };
      }
      if (sql.includes('UPDATE bookings')) {
        return { bind: mockUpdateBind };
      }
      if (sql.includes('INSERT INTO audit_log')) {
        return { bind: mockAuditBind };
      }
      return { bind: () => ({ run: () => ({}) }) };
    });

    const env = { DB: mockDB };
    const event = {};
    const ctx = {};

    await cronGdpr.scheduled(event, env, ctx);

    // Assert status check was called
    expect(mockFirst).toHaveBeenCalled();

    // Assert update query was called with correct date bind
    expect(mockUpdateBind).toHaveBeenCalled();
    const boundDate = mockUpdateBind.mock.calls[0][0];
    expect(boundDate).toBeDefined();
    // It should be a valid ISO string
    expect(() => new Date(boundDate).toISOString()).not.toThrow();

    // Assert audit log query was called
    expect(mockAuditBind).toHaveBeenCalled();
    const auditParams = mockAuditBind.mock.calls[0];
    expect(auditParams[0]).toBeDefined(); // UUID
    expect(auditParams[1]).toContain('Anonymized 3 bookings');
  });

  it('should not write audit log if no bookings were anonymized', async () => {
    // 1. Mock status check to return 'active'
    const mockFirst = vi.fn().mockResolvedValue({ value: 'active' });
    
    // 2. Mock update result to return 0 changes
    const mockUpdateRun = vi.fn().mockResolvedValue({
      meta: { changes: 0 }
    });
    const mockUpdateBind = vi.fn().mockReturnValue({
      run: mockUpdateRun
    });

    mockDB.prepare.mockImplementation((sql) => {
      if (sql.includes('SELECT value FROM process_states')) {
        return { first: mockFirst };
      }
      if (sql.includes('UPDATE bookings')) {
        return { bind: mockUpdateBind };
      }
      return { bind: () => ({ run: () => ({}) }) };
    });

    const env = { DB: mockDB };
    const event = {};
    const ctx = {};

    await cronGdpr.scheduled(event, env, ctx);

    expect(mockFirst).toHaveBeenCalled();
    expect(mockUpdateBind).toHaveBeenCalled();
    
    // No audit log queries should have been prepared
    const preparedSQLs = mockDB.prepare.mock.calls.map(c => c[0]);
    const hasAuditLog = preparedSQLs.some(sql => sql.includes('INSERT INTO audit_log'));
    expect(hasAuditLog).toBe(false);
  });
});
