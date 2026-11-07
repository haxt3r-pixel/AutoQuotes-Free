import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDrivetrains,
  getEngines,
  getMakes,
  getModels,
  getTrims,
  getTrimNames,
  validateCatalogVehicle,
} from '../src/core/catalog.service.js';

test('1994 Ford F-150 exposes period-correct engines', () => {
  assert.deepEqual(getTrimNames('Ford', 'F-150', 1994), ['XL', 'XLT']);
  assert.deepEqual(getEngines('Ford', 'F-150', 'XLT', 1994), ['5.0L V8', '5.8L V8']);
  assert.equal(
    validateCatalogVehicle({
      year: 1994,
      make: 'Ford',
      model: 'F-150',
      submodel: 'XLT',
      engine: '3.5L V6 EcoBoost',
    }),
    '3.5L V6 EcoBoost is not valid for a 1994 Ford F-150',
  );
});

test('modern F-150 configurations remain available only in their valid years', () => {
  assert.deepEqual(getEngines('Ford', 'F-150', 'Raptor', 1994), []);
  assert.deepEqual(getEngines('Ford', 'F-150', 'Raptor', 2020), ['3.5L V6 EcoBoost HO']);
});

test('2011 Honda Pilot exposes only trims valid for that generation', () => {
  assert.deepEqual(getTrimNames('Honda', 'Pilot', 2011), ['LX', 'EX', 'EX-L', 'Touring']);
  assert.deepEqual(getEngines('Honda', 'Pilot', 'EX-L', 2011), ['3.5L V6']);
  assert.equal(
    validateCatalogVehicle({ year: 2011, make: 'Honda', model: 'Pilot', submodel: 'EX-L', engine: '3.5L V6' }),
    null,
  );
});

test('Ford E-Series vans are available in the year-filtered catalog', () => {
  assert.ok(getTrimNames('Ford', 'E-350', 1994).includes('Base'));
  assert.deepEqual(getEngines('Ford', 'E-350', 'Base', 1994), ['5.8L V8']);
  assert.ok(getTrimNames('Ford', 'E-350 Super Duty', 2022).includes('Cutaway'));
});

test('2006 Chrysler Town & Country exposes period-correct configurations', () => {
  assert.deepEqual(
    getTrimNames('Chrysler', 'Town & Country', 2006),
    ['Base', 'LX', 'Touring', 'Limited'],
  );
  assert.deepEqual(getEngines('Chrysler', 'Town & Country', 'LX', 2006), ['3.3L V6']);
  assert.deepEqual(getEngines('Chrysler', 'Town & Country', 'Touring', 2006), ['3.8L V6']);
  assert.deepEqual(
    getDrivetrains('Chrysler', 'Town & Country', 'Limited', 2006, '3.8L V6'),
    ['FWD'],
  );
});

test('every catalog model-year has trims, engines, and drivetrains', () => {
  for (const make of getMakes()) {
    for (const model of getModels(make)) {
      const firstYear = model.years[0];
      const lastYear = model.years[model.years.length - 1];

      for (let year = firstYear; year <= lastYear; year += 1) {
        const trims = getTrimNames(make, model.model, year);
        assert.ok(trims.length > 0, `${year} ${make} ${model.model} has no trims`);

        for (const trim of trims) {
          const engines = getEngines(make, model.model, trim, year);
          assert.ok(engines.length > 0, `${year} ${make} ${model.model} ${trim} has no engines`);

          for (const engine of engines) {
            assert.ok(
              getDrivetrains(make, model.model, trim, year, engine).length > 0,
              `${year} ${make} ${model.model} ${trim} ${engine} has no drivetrains`,
            );
          }
        }

        assert.ok(getTrims(make, model.model, year).length > 0);
      }
    }
  }
});
