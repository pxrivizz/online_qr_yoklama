const test = require('node:test');
const assert = require('node:assert/strict');

test('passwords are hashed and verified', async () => {
  const { hashPassword, verifyPassword } = require('../src/services/passwordService');
  const hash = await hashPassword('CorrectHorseBatteryStaple!');
  assert.notEqual(hash, 'CorrectHorseBatteryStaple!');
  assert.equal((await verifyPassword('CorrectHorseBatteryStaple!', hash)).valid, true);
  assert.equal((await verifyPassword('wrong', hash)).valid, false);
});

test('QR tokens use the dedicated secret and expected claims', () => {
  const previous = process.env.QR_SECRET;
  process.env.QR_SECRET = 'M4u@eK9cV2bN7qW1xD8sL5pR3tY6fH0j';
  const qr = require('../src/services/qrService');
  const token = qr.generateQRToken('00000000-0000-4000-8000-000000000001');
  assert.equal(qr.verifyQRToken(token).type, 'qr');
  if (previous === undefined) delete process.env.QR_SECRET;
  else process.env.QR_SECRET = previous;
});

test('spreadsheet formulas are neutralized', () => {
  const { sanitizeSpreadsheetCell } = require('../src/services/spreadsheetService');
  assert.equal(sanitizeSpreadsheetCell('=HYPERLINK("x")'), "'=HYPERLINK(\"x\")");
  assert.equal(sanitizeSpreadsheetCell('normal'), 'normal');
});

test('IPv4-mapped addresses and CIDR boundaries are handled', () => {
  const { isWithinAllowedNetwork } = require('../src/services/locationService');
  assert.equal(isWithinAllowedNetwork('::ffff:192.168.1.4', '192.168.1.0/24').valid, true);
  assert.equal(isWithinAllowedNetwork('192.168.2.4', '192.168.1.0/24').valid, false);
  assert.equal(isWithinAllowedNetwork('192.168.1.4', '192.168.1.0/33').valid, false);
});
