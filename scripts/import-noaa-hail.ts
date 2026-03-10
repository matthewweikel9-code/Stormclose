/**
 * NOAA Historical Hail Data Import Script
 * 
 * Downloads and imports 1955-2023 hail events from NOAA SPC
 * Run with: npx tsx scripts/import-noaa-hail.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as readline from 'readline';

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Run: source .env.local && npx tsx scripts/import-noaa-hail.ts');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// US State abbreviations for validation
const US_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', 'PR', 'VI'
]);

interface HailEvent {
  event_date: string;
  event_time: string | null;
  timezone: number;
  state: string;
  latitude: number;
  longitude: number;
  size_inches: number;
  source: string;
}

async function importHailData(csvPath: string) {
  console.log('🌩️  NOAA Historical Hail Data Import');
  console.log('=====================================\n');

  // Check if file exists
  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    console.log('\nDownload the data first:');
    console.log('curl -L "https://www.spc.noaa.gov/wcm/data/1955-2023_hail.csv.zip" -o /tmp/noaa_hail.zip');
    console.log('unzip /tmp/noaa_hail.zip -d /tmp/');
    process.exit(1);
  }

  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineNumber = 0;
  let batch: HailEvent[] = [];
  let totalImported = 0;
  let skipped = 0;
  let errors = 0;
  const BATCH_SIZE = 1000;

  // Track progress
  const startTime = Date.now();

  for await (const line of rl) {
    lineNumber++;
    
    // Skip header row
    if (lineNumber === 1) {
      console.log('Header:', line.substring(0, 80) + '...');
      continue;
    }

    try {
      // Parse CSV line
      // Format: om,yr,mo,dy,date,time,tz,st,stf,stn,mag,inj,fat,loss,closs,slat,slon,elat,elon,len,wid,ns,sn,sg,f1,f2,f3,f4
      const parts = line.split(',');
      
      if (parts.length < 17) {
        skipped++;
        continue;
      }

      const [
        _om, _yr, _mo, _dy, date, time, tz, state, _stf, _stn,
        mag, _inj, _fat, _loss, _closs, slat, slon
      ] = parts;

      // Validate state
      if (!US_STATES.has(state)) {
        skipped++;
        continue;
      }

      // Parse coordinates
      const latitude = parseFloat(slat);
      const longitude = parseFloat(slon);

      if (isNaN(latitude) || isNaN(longitude) || latitude === 0 || longitude === 0) {
        skipped++;
        continue;
      }

      // Parse hail size
      const sizeInches = parseFloat(mag);
      if (isNaN(sizeInches) || sizeInches <= 0) {
        skipped++;
        continue;
      }

      // Parse timezone
      const timezone = parseInt(tz) || 3;

      // Format time (handle "00:00:00" format)
      let eventTime: string | null = time;
      if (!time || time === '00:00:00' || time.trim() === '') {
        eventTime = null;
      }

      batch.push({
        event_date: date,
        event_time: eventTime,
        timezone,
        state,
        latitude,
        longitude,
        size_inches: sizeInches,
        source: 'noaa_historical'
      });

      // Insert batch when full
      if (batch.length >= BATCH_SIZE) {
        const { error } = await supabase
          .from('hail_events')
          .upsert(batch, { 
            onConflict: 'event_date,event_time,latitude,longitude,size_inches',
            ignoreDuplicates: true 
          });

        if (error) {
          console.error(`\n❌ Batch error at line ${lineNumber}:`, error.message);
          errors += batch.length;
        } else {
          totalImported += batch.length;
        }

        // Progress update
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = totalImported / elapsed;
        process.stdout.write(`\r📥 Imported: ${totalImported.toLocaleString()} | Skipped: ${skipped.toLocaleString()} | Rate: ${rate.toFixed(0)}/sec`);
        
        batch = [];
      }
    } catch (err) {
      errors++;
      if (errors < 10) {
        console.error(`\n❌ Error on line ${lineNumber}:`, err);
      }
    }
  }

  // Insert remaining records
  if (batch.length > 0) {
    const { error } = await supabase
      .from('hail_events')
      .upsert(batch, { 
        onConflict: 'event_date,event_time,latitude,longitude,size_inches',
        ignoreDuplicates: true 
      });

    if (error) {
      console.error(`\n❌ Final batch error:`, error.message);
      errors += batch.length;
    } else {
      totalImported += batch.length;
    }
  }

  const elapsed = (Date.now() - startTime) / 1000;

  console.log('\n\n=====================================');
  console.log('✅ Import Complete!');
  console.log('=====================================');
  console.log(`📊 Total Lines:    ${(lineNumber - 1).toLocaleString()}`);
  console.log(`✅ Imported:       ${totalImported.toLocaleString()}`);
  console.log(`⏭️  Skipped:        ${skipped.toLocaleString()}`);
  console.log(`❌ Errors:         ${errors.toLocaleString()}`);
  console.log(`⏱️  Duration:       ${elapsed.toFixed(1)} seconds`);
  console.log(`🚀 Rate:           ${(totalImported / elapsed).toFixed(0)} records/sec`);

  // Verify count in database
  const { count } = await supabase
    .from('hail_events')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📦 Total records in database: ${count?.toLocaleString() || 'unknown'}`);
}

// Run the import
const csvPath = process.argv[2] || '/tmp/1955-2023_hail.csv';
importHailData(csvPath).catch(console.error);
