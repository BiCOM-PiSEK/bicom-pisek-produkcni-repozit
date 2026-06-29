import { describe, it, expect, vi, beforeEach } from 'vitest';
import queueConsumer from '../functions/api/_queue-booking.js';
import { DataCrypt } from '../functions/lib/datacrypt.js';

vi.mock('../functions/lib/connectors/google-calendar.js', () => {
  return {
    GoogleCalendarConnector: vi.fn().mockImplementation(() => {
      return {
        insertEvent: vi.fn().mockResolvedValue({ id: 'mock-event-123' })
      };
    })
  };
});

vi.mock('../functions/lib/connectors/telegram.js', () => {
  return {
    TelegramConnector: vi.fn().mockImplementation(() => {
      return {
        sendBookingNotification: vi.fn().mockResolvedValue(true)
      };
    })
  };
});

vi.mock('../functions/lib/connectors/resend.js', () => {
  return {
    ResendConnector: vi.fn().mockImplementation(() => {
      return {
        sendBookingConfirmation: vi.fn().mockResolvedValue(true)
      };
    })
  };
});

describe('Booking Queue Consumer — Secure DB Decryption', () => {
  const SECRET_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  let mockDB;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDB = {
      prepare: vi.fn()
    };
  });

  it('should fetch booking from DB, decrypt PII, and execute integration flows', async () => {
    const crypt = new DataCrypt(SECRET_KEY);
    const mockBookingId = 'test-booking-uuid-123';
    
    // Encrypt client data
    const nameEnc = await crypt.encrypt('Jan Novak');
    const emailEnc = await crypt.encrypt('jan.novak@example.com');
    const phoneEnc = await crypt.encrypt('+420777123456');
    const noteEnc = await crypt.encrypt('Some note here');

    const dbRow = {
      id: mockBookingId,
      name_enc: nameEnc,
      email_enc: emailEnc,
      phone_enc: phoneEnc,
      note_enc: noteEnc,
      service: 'metabolismus',
      preferred_date: '2026-07-10T12:00:00.000Z',
      slot_start: '2026-07-10 12:00',
      slot_end: '2026-07-10 13:00',
      estimated_price: 1500,
      reminder_channel: 'sms',
      calendar_event_id: null
    };

    // Mock DB queries & capture binds
    const binds = {};
    mockDB.prepare.mockImplementation((sql) => {
      const mockBind = vi.fn().mockImplementation((...args) => {
        binds[sql] = args;
        return {
          first: vi.fn().mockResolvedValue(dbRow),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } })
        };
      });
      return {
        bind: mockBind
      };
    });

    const env = {
      DB: mockDB,
      SECRET_ENCRYPTION_KEY: SECRET_KEY
    };

    const mockMessage = {
      body: {
        bookingId: mockBookingId
      },
      ack: vi.fn(),
      retry: vi.fn()
    };

    const batch = {
      messages: [mockMessage]
    };

    // Run queue consumer
    await queueConsumer.queue(batch, env);

    // Verify DB fetches were called
    expect(mockDB.prepare).toHaveBeenCalledWith(expect.stringContaining('bookings WHERE id = ?'));
    expect(mockMessage.ack).toHaveBeenCalled();
    expect(mockMessage.retry).not.toHaveBeenCalled();

    // Verify update for calendar_event_id was called with correct values
    const calendarUpdateSql = Object.keys(binds).find(sql => sql.includes('UPDATE bookings SET calendar_event_id = ?'));
    expect(calendarUpdateSql).toBeDefined();
    expect(binds[calendarUpdateSql]).toEqual(['mock-event-123', mockBookingId]);

    // Verify Email Reminder Insert
    const emailReminderSql = Object.keys(binds).find(sql => sql.includes('INSERT INTO reminders') && sql.includes("'email'"));
    expect(emailReminderSql).toBeDefined();
    expect(binds[emailReminderSql][1]).toBe(mockBookingId);

    // Verify SMS Reminder Insert
    const smsReminderSql = Object.keys(binds).find(sql => sql.includes('INSERT INTO reminders') && sql.includes("'sms'"));
    expect(smsReminderSql).toBeDefined();
    expect(binds[smsReminderSql][1]).toBe(mockBookingId);

    // Verify Audit Log Write
    const auditLogSql = Object.keys(binds).find(sql => sql.includes('INSERT INTO audit_log'));
    expect(auditLogSql).toBeDefined();
    expect(binds[auditLogSql][1]).toBe(mockBookingId);
  });
});
