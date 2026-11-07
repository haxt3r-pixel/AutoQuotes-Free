import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSettingValue, settingsUpdateSchema,
} from '../src/validation/schemas.js';
import { redactSensitiveSettings } from '../src/routes/settings.routes.js';

test('settings validation accepts typed values and rejects null or unknown values', () => {
  assert.deepEqual(
    settingsUpdateSchema.parse({ labor_rate: 12500, smtp_secure: false }),
    { labor_rate: 12500, smtp_secure: false },
  );
  assert.throws(() => settingsUpdateSchema.parse({ labor_rate: null }));
  assert.throws(() => settingsUpdateSchema.parse({ unexpected: true }));
  assert.throws(() => parseSettingValue('smtp_port', '587'));
  assert.equal(parseSettingValue('smtp_port', 587), 587);
});

test('settings responses redact SMTP passwords', () => {
  assert.deepEqual(
    redactSensitiveSettings({ labor_rate: 12000, smtp_pass: 'secret' }),
    { labor_rate: 12000, smtp_pass_configured: true },
  );
});
