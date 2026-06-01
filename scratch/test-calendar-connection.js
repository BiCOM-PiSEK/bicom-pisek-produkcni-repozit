// scratch/test-calendar-connection.js
// Tests Google Calendar integration locally using secrets defined in .dev.vars

import fs from 'fs';
import path from 'path';
import { GoogleCalendarConnector } from '../functions/lib/connectors/google-calendar.js';

// Helper to load and parse .dev.vars file
function loadDevVars() {
  const varsPath = path.resolve('.dev.vars');
  if (!fs.existsSync(varsPath)) {
    console.error('❌ Error: .dev.vars file does not exist. Run setup first.');
    process.exit(1);
  }

  const content = fs.readFileSync(varsPath, 'utf-8');
  const env = {};

  // Regex to match KEY="VALUE" where VALUE can span multiple lines (using [\s\S]*? for multiline)
  const regex = /^\s*([A-Za-z0-9_]+)\s*=\s*(?:"([\s\S]*?)"|'([\s\S]*?)'|([^\s#]+))\s*(?:#.*)?$/gm;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const key = match[1];
    const val = match[2] !== undefined ? match[2] : (match[3] !== undefined ? match[3] : match[4]);
    env[key] = val;
  }

  return env;
}

async function testConnection() {
  console.log('🔄 Loading credentials from .dev.vars...');
  const env = loadDevVars();
  
  if (!env.SECRET_GOOGLE_CALENDAR_CLIENT_EMAIL || !env.SECRET_GOOGLE_CALENDAR_PRIVATE_KEY || !env.SECRET_GOOGLE_CALENDAR_ID) {
    console.error('❌ Error: Google Calendar secrets are missing in .dev.vars.');
    process.exit(1);
  }

  console.log(`- Service Account Email: ${env.SECRET_GOOGLE_CALENDAR_CLIENT_EMAIL}`);
  console.log(`- Calendar ID: ${env.SECRET_GOOGLE_CALENDAR_ID}`);
  console.log(`- Private Key length: ${env.SECRET_GOOGLE_CALENDAR_PRIVATE_KEY.length} chars`);
  
  console.log('\n🔄 Initializing GoogleCalendarConnector...');
  const connector = new GoogleCalendarConnector(env);
  
  if (!connector.configured) {
    console.error('❌ Error: Connector claims to be unconfigured. Check key configuration.');
    process.exit(1);
  }
  
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  
  console.log(`\n🔄 Calling listEvents from ${timeMin} to ${timeMax}...`);
  try {
    const events = await connector.listEvents(timeMin, timeMax);
    console.log('✅ Connection successful!');
    console.log(`🎉 Retrieved ${events.length} events for the next 7 days:`);
    
    if (events.length === 0) {
      console.log('  (No events scheduled in this period, but connection works perfectly)');
    } else {
      events.forEach((evt) => {
        const start = evt.start?.dateTime || evt.start?.date;
        console.log(`  - [${start}] ${evt.summary} (ID: ${evt.id})`);
      });
    }
  } catch (err) {
    console.error('❌ Test failed with exception:', err);
  }
}

testConnection();
