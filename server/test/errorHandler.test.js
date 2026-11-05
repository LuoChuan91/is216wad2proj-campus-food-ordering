const test = require('node:test');
const assert = require('node:assert/strict');
const errorHandler = require('../src/common/errorHandler');

function fakeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('error handler: a malformed id is a 400, not a 500', () => {
  const res = fakeRes();
  errorHandler({ code: '22P02', message: 'invalid input syntax for type uuid: "abc"' }, {}, res);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'Invalid id' });
});

test('error handler: our own errors keep their status and message', () => {
  const res = fakeRes();
  const err = Object.assign(new Error('Store not found'), { status: 404 });
  errorHandler(err, {}, res);
  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: 'Store not found' });
});
