// ============================================================
// seed_auth_users.mjs
//
// Invite-only user provisioning for the Online Food Ordering
// System. Creates all 23 auth users via the Supabase Admin API.
//
// TWO GROUPS (Variant 2 — everyone gets a temp password so
// normal email+password login works with fake addresses; the
// difference is the password_set flag + status):
//
//   A. "Already set up"  (password_set = true)
//      3 admins + 5 merchants + 2 active students
//      + 2 blocked students + 2 removed students = 14 users.
//      status is their real status (active / blocked / removed).
//
//   B. "Invited, not set up"  (password_set = false, status
//      'inactive') = the remaining 9 students. They still get a
//      temp password, but the app detects password_set = false
//      after login and routes them to the create-password page
//      (which calls supabase.auth.updateUser({ password })).
//
// email_confirm: true -> NO email is ever sent, so fake /
// non-deliverable addresses are fine.
//
// status + password_set are passed as user_metadata and written
// to public.profiles by the handle_new_user() trigger, so no
// follow-up UPDATE is needed.
//
// PREREQUISITES
//   npm install @supabase/supabase-js
//   create_database.sql already run (schema + trigger)
//   Public sign-up DISABLED in Auth settings (invite-only)
//
// RUN
//   SUPABASE_URL="https://<project-ref>.supabase.co" \
//   SUPABASE_SERVICE_ROLE_KEY="<service_role key>" \
//   node seed_auth_users.mjs
//
// WARNING: the service_role key bypasses RLS. Keep it secret;
// never ship it to the browser / client bundle.
// ============================================================

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env vars. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

// Temp password given to EVERY account so normal login works.
// Group A users keep it as their "already chosen" password.
// Group B users will replace it on the create-password page.
const TEMP_PASSWORD = process.env.DEFAULT_PWD

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ------------------------------------------------------------
// The 23 accounts.
//   status:       'active' | 'inactive' | 'blocked' | 'removed'
//   passwordSet:  true  = account already set up
//                 false = invited, must set password on 1st login
// ------------------------------------------------------------
const users = [
  // ---- Group A: already set up (password_set = true) ----

  // 2 active students with a password
  { email: 'aiden.tan.2021@scis.smu.edu.sg',        name: 'Aiden Tan',    role: 'student',  phone: '81234567', status: 'active',   passwordSet: true  },
  { email: 'beatrice.lim.2021@business.smu.edu.sg', name: 'Beatrice Lim', role: 'student',  phone: '82345671', status: 'active',   passwordSet: true  },

  // 2 blocked students (already have a password)
  { email: 'ethan.koh.2021@scis.smu.edu.sg',        name: 'Ethan Koh',    role: 'student',  phone: '85671234', status: 'blocked',  passwordSet: true  },
  { email: 'jasmine.ong.2023@scis.smu.edu.sg',      name: 'Jasmine Ong',  role: 'student',  phone: '80123459', status: 'blocked',  passwordSet: true  },

  // 2 removed / graduated students (already have a password)
  { email: 'caleb.wong.2020@economics.smu.edu.sg',  name: 'Caleb Wong',   role: 'student',  phone: '83456712', status: 'removed',  passwordSet: true  },
  { email: 'gabriel.lee.2020@socsc.smu.edu.sg',     name: 'Gabriel Lee',  role: 'student',  phone: '87123456', status: 'removed',  passwordSet: true  },

  // 5 merchants (active; Spice Route still blocked). All set up.
  { email: 'orders@campuswok.com.sg',    name: 'Campus Wok Express', role: 'merchant', phone: '91234567', status: 'active',  passwordSet: true },
  { email: 'hello@greenbowl.sg',         name: 'Green Bowl Salads',  role: 'merchant', phone: '92345671', status: 'active',  passwordSet: true },
  { email: 'contact@kopicorner.com',     name: 'Kopi Corner Cafe',   role: 'merchant', phone: '93456712', status: 'active',  passwordSet: true },
  { email: 'info@spiceroute.sg',         name: 'Spice Route Indian', role: 'merchant', phone: '94567123', status: 'blocked', passwordSet: true },
  { email: 'support@sakurabento.com.sg', name: 'Sakura Bento House', role: 'merchant', phone: '95671234', status: 'active',  passwordSet: true },

  // 3 admins (active). All set up.
  { email: 'rachel.lim@smu.edu.sg', name: 'Rachel Lim', role: 'admin', phone: '71234567', status: 'active', passwordSet: true },
  { email: 'samuel.tan@smu.edu.sg', name: 'Samuel Tan', role: 'admin', phone: '72345671', status: 'active', passwordSet: true },
  { email: 'priya.nair@smu.edu.sg', name: 'Priya Nair', role: 'admin', phone: '73456712', status: 'active', passwordSet: true },

  // ---- Group B: invited, not set up (password_set = false, inactive) ----
  // Remaining 9 students.
  { email: 'danielle.ng.2022@law.smu.edu.sg',        name: 'Danielle Ng', role: 'student', phone: '84567123', status: 'inactive', passwordSet: false },
  { email: 'faith.chua.2023@accountancy.smu.edu.sg', name: 'Faith Chua',  role: 'student', phone: '86712345', status: 'inactive', passwordSet: false },
  { email: 'hannah.goh.2022@business.smu.edu.sg',    name: 'Hannah Goh',  role: 'student', phone: '88123457', status: 'inactive', passwordSet: false },
  { email: 'isaac.teo.2021@economics.smu.edu.sg',    name: 'Isaac Teo',   role: 'student', phone: '89123458', status: 'inactive', passwordSet: false },
  { email: 'kevin.sim.2022@law.smu.edu.sg',          name: 'Kevin Sim',   role: 'student', phone: '81023450', status: 'inactive', passwordSet: false },
  { email: 'lydia.chan.2021@accountancy.smu.edu.sg', name: 'Lydia Chan',  role: 'student', phone: '81203451', status: 'inactive', passwordSet: false },
  { email: 'marcus.yeo.2023@socsc.smu.edu.sg',       name: 'Marcus Yeo',  role: 'student', phone: '81230452', status: 'inactive', passwordSet: false },
  { email: 'natalie.foo.2022@business.smu.edu.sg',   name: 'Natalie Foo', role: 'student', phone: '81234053', status: 'inactive', passwordSet: false },
  { email: 'oliver.tay.2021@scis.smu.edu.sg',        name: 'Oliver Tay',  role: 'student', phone: '81234503', status: 'inactive', passwordSet: false },
]

async function run() {
  let created = 0
  let failed = 0

  for (const u of users) {
    // Create the auth user. The handle_new_user trigger inserts
    // the matching public.profiles row and reads role / name /
    // phone / status / password_set straight from user_metadata.
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: TEMP_PASSWORD,
      email_confirm: true, // no email sent; works with fake addresses
      user_metadata: {
        name: u.name,
        role: u.role,
        phone: u.phone,
        status: u.status,
        password_set: u.passwordSet,
      },
    })

    if (error) {
      failed++
      console.error(`FAIL  ${u.email}: ${error.message}`)
      continue
    }

    created++
    const flag = u.passwordSet ? 'set' : 'INVITED'
    console.log(`OK    ${u.email}  [${u.role}/${u.status}/${flag}]  ->  ${data.user.id}`)
  }

  console.log(`\nDone. created=${created} failed=${failed} total=${users.length}`)
  console.log(`Temp password for all accounts: ${TEMP_PASSWORD}`)
  console.log(`Group A (password_set=true): already set up.`)
  console.log(`Group B (password_set=false, inactive): invited; app shows create-password page on first login.`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
