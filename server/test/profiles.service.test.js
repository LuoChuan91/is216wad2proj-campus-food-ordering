// Unit tests for src/services/profiles.service.js: finishing an invited account's password set-up.
// Run from the server folder:  pnpm test
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL ||= 'http://localhost:54321';
process.env.SUPABASE_SECRET_KEY ||= 'test-only';

const service = require('../src/services/profiles.service');
const profilesRepository = require('../src/models/profiles.repository');

let saved;
test.beforeEach(() => {
  saved = null;
  profilesRepository.findById = async (id) => (id === 'stu-1' ? { id, role: 'student', status: 'active', password_set: false } : null);
  profilesRepository.update = async (id, changes) => { saved = changes; return { id, ...changes }; };
});

test('an invited user can mark their own password as set', async () => {
  const profile = await service.markPasswordSet('stu-1', 'stu-1');
  assert.equal(profile.password_set, true);
  assert.deepEqual(saved, { password_set: true });
});

test('nobody else can mark it, and an unknown account is a 404', async () => {
  await assert.rejects(service.markPasswordSet('stu-1', 'stu-2'), { status: 403 });
  await assert.rejects(service.markPasswordSet('stu-1', undefined), { status: 403 });
  await assert.rejects(service.markPasswordSet('nope', 'nope'), { status: 404 });
  assert.equal(saved, null);
});
