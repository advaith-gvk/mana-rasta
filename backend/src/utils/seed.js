/**
 * Seed script — GHMC zones, circles, wards, OFFICERS, achievements, rewards.
 *
 * Real ward boundaries should be loaded from the official GHMC shapefile.
 * This seed uses approximate representative polygons for development/testing.
 * Obtain official GHMC GIS data: https://www.ghmc.gov.in/gisdata
 *
 * Officer names are representative placeholders — replace with actual GHMC staff.
 */

require('dotenv').config({ path: '../.env' });
const { pool } = require('../src/config/db');
const bcrypt   = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const ZONES = [
  { code: 'LB',  name: 'LB Nagar Zone',       lat: 17.3300, lng: 78.5600, spread: 0.12 },
  { code: 'SR',  name: 'Serilingampally Zone', lat: 17.4700, lng: 78.3200, spread: 0.12 },
  { code: 'KPM', name: 'Kapra Zone',           lat: 17.4800, lng: 78.5600, spread: 0.10 },
  { code: 'CHM', name: 'Charminar Zone',       lat: 17.3600, lng: 78.4700, spread: 0.09 },
  { code: 'KHI', name: 'Khairatabad Zone',     lat: 17.4200, lng: 78.4500, spread: 0.10 },
  { code: 'SEC', name: 'Secunderabad Zone',    lat: 17.4400, lng: 78.5000, spread: 0.08 },
];

function makePolygon(lat, lng, spread) {
  const d = spread;
  return `MULTIPOLYGON(((${lng-d} ${lat-d}, ${lng+d} ${lat-d}, ${lng+d} ${lat+d}, ${lng-d} ${lat+d}, ${lng-d} ${lat-d})))`;
}

const AE_NAMES = [
  'P. Ramesh Kumar','S. Sudhakar Rao','K. Venkat Reddy','N. Srinivas',
  'M. Padma Latha','T. Ravi Shankar','B. Krishna Murthy','G. Vijaya Lakshmi',
  'R. Anil Kumar','V. Sathish Babu','L. Madhavi','C. Narayana Rao',
  'D. Hemalatha','A. Suresh','F. Rajesh','H. Usha Rani',
  'J. Kiran Kumar','O. Swathi','Q. Srikanth','X. Pushpa',
  'Y. Ganesh','Z. Priya','Aa. Ramu','Ab. Sailaja',
  'Ac. Prasad','Ad. Lalitha','Ae. Naresh','Af. Sunitha',
  'Ag. Mohan','Ah. Kavitha','Ai. Siva Rao','Aj. Rekha',
  'Ak. Hari Babu','Al. Padmaja','Am. Kishore','An. Sujatha',
  'Ao. Venu Gopal','Ap. Aruna','Aq. Sekhar','Ar. Mamatha',
  'As. Bhaskar','At. Jyothi','Au. Venkatraman','Av. Ratna',
  'Aw. Sreedhar','Ax. Aparna','Ay. Tirupathi','Az. Vasantha',
  'Ba. Chandra Sekhar','Bb. Nandini','Bc. Bhaskara Rao','Bd. Sowmya',
  'Be. Nageswara Rao','Bf. Deepika','Bg. Ranga Rao','Bh. Anitha',
  'Bi. Lakshmaiah','Bj. Swapna','Bk. Veeraiah','Bl. Sravanthi',
];

const EE_NAMES = [
  'Ch. Murali Mohan','Dr. K. Suresh','P. Srinivasa Reddy','R. Vijaya Kumar',
  'S. Nagabhushanam','T. Lakshmi Prasad','U. Chandrasekhar','V. Sarada',
  'W. Ramakrishna','X. Nirmala','Y. Ashok Kumar','Z. Sailaja Devi',
];

const SE_NAMES = [
  'B. Venkatesh','K. Srinivas Reddy','M. Raj Kumar',
  'N. Padmavathi','R. Govind Rao','T. Seshagiri Rao',
];

const ACHIEVEMENTS = [
  { code: 'FIRST_REPORT',    name: 'First Reporter',      description: 'Submit your first pothole report',    points: 50   },
  { code: 'WARD_CHAMPION',   name: 'Ward Champion',       description: 'First report in a new ward',          points: 100  },
  { code: 'COMMUNITY_GUARD', name: 'Community Validator', description: "Verify 10 others' reports",          points: 75   },
  { code: 'ZONE_CHAMPION',   name: 'Zone Champion',       description: 'Top reporter in a zone for 1 month', points: 200  },
  { code: 'FAST_FIX',        name: 'Fast Fix',            description: '3 reports fixed within 48 hours',    points: 150  },
  { code: 'STREAK_7',        name: '7-Day Streak',        description: 'Report 7 days in a row',             points: 100  },
  { code: 'STREAK_30',       name: 'Monthly Reporter',    description: 'Report 30 days in a row',            points: 500  },
  { code: 'CENTURY',         name: 'Century Reporter',    description: '100 verified reports',                points: 1000 },
];

const REWARD_CATALOG = [
  { title: 'Big Basket ₹100 voucher', partner: 'Big Basket', cost: 500,  stock: 100 },
  { title: 'Swiggy ₹150 voucher',     partner: 'Swiggy',     cost: 750,  stock: 200 },
  { title: 'Paytm ₹50 cashback',      partner: 'Paytm',      cost: 250,  stock: 500 },
  { title: 'BookMyShow ₹200 voucher', partner: 'BookMyShow', cost: 1000, stock: 50  },
  { title: 'Amazon ₹500 gift card',   partner: 'Amazon',     cost: 2500, stock: 20  },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Zones ──────────────────────────────────────────────
    console.log('Seeding zones…');
    const zoneIds = {};
    for (const z of ZONES) {
      const { rows } = await client.query(
        `INSERT INTO ghmc_zones(zone_code, name, boundary)
         VALUES($1, $2, ST_GeomFromText($3, 4326))
         ON CONFLICT (zone_code) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [z.code, z.name, makePolygon(z.lat, z.lng, z.spread)]
      );
      zoneIds[z.code] = rows[0].id;
    }

    // ── Circles ────────────────────────────────────────────
    console.log('Seeding circles…');
    const circleIds = {};
    for (const z of ZONES) {
      for (let i = 1; i <= 2; i++) {
        const code   = `${z.code}-C${i}`;
        const offset = i === 1 ? -0.04 : 0.04;
        const { rows } = await client.query(
          `INSERT INTO ghmc_circles(zone_id, circle_code, name, boundary)
           VALUES($1, $2, $3, ST_GeomFromText($4, 4326))
           ON CONFLICT (circle_code) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [zoneIds[z.code], code, `${z.name} Circle ${i}`,
           makePolygon(z.lat + offset, z.lng, z.spread * 0.5)]
        );
        circleIds[code] = rows[0].id;
      }
    }

    // ── Wards ──────────────────────────────────────────────
    console.log('Seeding wards…');
    const wardRows = [];
    let wardNum = 1;
    for (const z of ZONES) {
      for (let ci = 1; ci <= 2; ci++) {
        const circleCode = `${z.code}-C${ci}`;
        const cOffset    = ci === 1 ? -0.04 : 0.04;
        for (let wi = 1; wi <= 5; wi++) {
          const wLat = z.lat + cOffset + (wi - 3) * 0.016;
          const { rows } = await client.query(
            `INSERT INTO ghmc_wards(circle_id, zone_id, ward_number, name, boundary)
             VALUES($1, $2, $3, $4, ST_GeomFromText($5, 4326))
             ON CONFLICT (ward_number) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
            [circleIds[circleCode], zoneIds[z.code], wardNum,
             `Ward ${wardNum} – ${z.name}`, makePolygon(wLat, z.lng, 0.008)]
          );
          wardRows.push({ wardId: rows[0].id, wardNum, circleCode });
          wardNum++;
        }
      }
    }
    console.log(`Seeded ${wardNum - 1} wards`);

    // ── Officers ───────────────────────────────────────────
    console.log('Seeding officers…');
    let aeIdx = 0;
    for (const { wardId, wardNum: wn } of wardRows) {
      await client.query(
        `INSERT INTO ghmc_officers(id, name, designation, employee_id, ward_id, is_hq)
         VALUES($1, $2, 'AE', $3, $4, FALSE)
         ON CONFLICT (employee_id) DO NOTHING`,
        [uuidv4(), AE_NAMES[aeIdx % AE_NAMES.length],
         `AE-W${String(wn).padStart(3,'0')}`, wardId]
      );
      aeIdx++;
    }

    let eeIdx = 0;
    for (const [circleCode, circleId] of Object.entries(circleIds)) {
      await client.query(
        `INSERT INTO ghmc_officers(id, name, designation, employee_id, circle_id, is_hq)
         VALUES($1, $2, 'EE', $3, $4, FALSE)
         ON CONFLICT (employee_id) DO NOTHING`,
        [uuidv4(), EE_NAMES[eeIdx % EE_NAMES.length], `EE-${circleCode}`, circleId]
      );
      eeIdx++;
    }

    let seIdx = 0;
    for (const [zoneCode, zoneId] of Object.entries(zoneIds)) {
      await client.query(
        `INSERT INTO ghmc_officers(id, name, designation, employee_id, zone_id, is_hq)
         VALUES($1, $2, 'SE', $3, $4, FALSE)
         ON CONFLICT (employee_id) DO NOTHING`,
        [uuidv4(), SE_NAMES[seIdx % SE_NAMES.length], `SE-${zoneCode}`, zoneId]
      );
      seIdx++;
    }

    // HQ officers
    await client.query(
      `INSERT INTO ghmc_officers(id, name, designation, employee_id, is_hq)
       VALUES
         ($1, 'Sri B. Janardhan Reddy', 'CE',    'CE-PW-001', TRUE),
         ($2, 'Sri M. Suresh Kumar',    'AC_PW', 'ACPW-001',  TRUE)
       ON CONFLICT (employee_id) DO NOTHING`,
      [uuidv4(), uuidv4()]
    );
    console.log('Officers seeded');

    // ── Achievements ───────────────────────────────────────
    for (const a of ACHIEVEMENTS) {
      await client.query(
        `INSERT INTO achievements(code, name, description, points)
         VALUES($1,$2,$3,$4) ON CONFLICT(code) DO NOTHING`,
        [a.code, a.name, a.description, a.points]
      );
    }

    // ── Reward catalog ─────────────────────────────────────
    for (const r of REWARD_CATALOG) {
      await client.query(
        `INSERT INTO reward_catalog(title, partner_name, points_cost, stock)
         VALUES($1,$2,$3,$4)`,
        [r.title, r.partner, r.cost, r.stock]
      );
    }

    // ── Admin user ─────────────────────────────────────────
    await client.query(
      `INSERT INTO users(id, email, name, role, is_active, is_verified)
       VALUES($1, 'admin@ghmc.gov.in', 'GHMC Admin', 'admin', TRUE, TRUE)
       ON CONFLICT(email) DO NOTHING`,
      [uuidv4()]
    );

    // ── Refresh materialized views ─────────────────────────
    try {
      await client.query('SELECT refresh_performance_views()');
      console.log('Materialized views refreshed');
    } catch (err) {
      console.warn('Views not refreshed (run migration 002 first):', err.message);
    }

    await client.query('COMMIT');
    console.log('✅  Seed complete');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
