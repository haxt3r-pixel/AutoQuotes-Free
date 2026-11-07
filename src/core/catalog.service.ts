import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface CatalogMake {
  make: string;
  models: CatalogModel[];
}

export interface CatalogModel {
  model: string;
  years: number[];
  trims: CatalogTrim[];
}

export interface CatalogTrim {
  trim: string;
  engine: string;
  drivetrain: string;
  yearStart?: number;
  yearEnd?: number;
}

const CATALOG_PATH = path.join(__dirname, '..', '..', 'data', 'vehicle-catalog.json');

let catalogCache: CatalogMake[] | null = null;

function loadCatalog(): CatalogMake[] {
  if (catalogCache) return catalogCache;
  const data = fs.readFileSync(CATALOG_PATH, 'utf-8');
  catalogCache = JSON.parse(data) as CatalogMake[];
  return catalogCache;
}

export function getMakes(): string[] {
  return loadCatalog().map(m => m.make);
}

export function getModels(make: string): CatalogModel[] {
  const catalog = loadCatalog();
  const entry = catalog.find(m => m.make.toLowerCase() === make.toLowerCase());
  return entry ? entry.models : [];
}

function getModel(make: string, model: string): CatalogModel | null {
  const models = getModels(make);
  return models.find(m => m.model.toLowerCase() === model.toLowerCase()) || null;
}

export function getTrims(make: string, model: string, year?: number): CatalogTrim[] {
  const entry = getModel(make, model);
  if (!entry) return [];
  if (!year) return entry.trims;

  const yearScoped = entry.trims.filter(trim => trim.yearStart !== undefined || trim.yearEnd !== undefined);
  if (yearScoped.length > 0) {
    const matchingYear = yearScoped.filter(trim =>
      year >= (trim.yearStart ?? entry.years[0]) &&
      year <= (trim.yearEnd ?? entry.years[entry.years.length - 1]),
    );
    if (matchingYear.length > 0) return matchingYear;
  }

  return entry.trims.filter(trim => trim.yearStart === undefined && trim.yearEnd === undefined);
}

export function getTrimDetail(make: string, model: string, trim: string, year?: number): CatalogTrim | null {
  const trims = getTrims(make, model, year);
  return trims.find(t => t.trim.toLowerCase() === trim.toLowerCase()) || null;
}

export function getDrivetrains(make: string, model: string, trim: string, year?: number, engine?: string): string[] {
  return [...new Set(
    getTrims(make, model, year)
      .filter(t => t.trim.toLowerCase() === trim.toLowerCase())
      .filter(t => !engine || t.engine.toLowerCase() === engine.toLowerCase())
      .map(t => t.drivetrain),
  )];
}

export function getEngines(make: string, model: string, trim: string, year?: number): string[] {
  return [...new Set(
    getTrims(make, model, year)
      .filter(t => t.trim.toLowerCase() === trim.toLowerCase())
      .map(t => t.engine),
  )];
}

/** Get flat list of all trims for a given make+model combo */
export function getTrimNames(make: string, model: string, year?: number): string[] {
  return [...new Set(getTrims(make, model, year).map(t => t.trim))];
}

/** Get distinct years range for a model */
export function getModelYearRange(make: string, model: string): [number, number] | null {
  const models = getModels(make);
  const entry = models.find(m => m.model.toLowerCase() === model.toLowerCase());
  if (!entry || !entry.years || entry.years.length < 2) return null;
  return [entry.years[0], entry.years[entry.years.length - 1]];
}

export function validateCatalogVehicle(input: {
  year?: number | null;
  make?: string | null;
  model?: string | null;
  submodel?: string | null;
  engine?: string | null;
}): string | null {
  if (!input.year || !input.make || !input.model) return null;
  const model = getModel(input.make, input.model);
  if (!model) return null;
  const [firstYear, lastYear] = [model.years[0], model.years[model.years.length - 1]];
  if (input.year < firstYear || input.year > lastYear) {
    return `${input.model} is only listed for model years ${firstYear}-${lastYear}`;
  }
  if (!input.engine) return null;

  const hasYearScopedData = model.trims.some(t => t.yearStart !== undefined || t.yearEnd !== undefined);
  if (!hasYearScopedData) return null;
  const allMatchingEngine = model.trims.filter(t => t.engine.toLowerCase() === input.engine!.toLowerCase());
  if (allMatchingEngine.length === 0) return null;
  const validForYear = getTrims(input.make, input.model, input.year)
    .some(t => t.engine.toLowerCase() === input.engine!.toLowerCase());
  return validForYear ? null : `${input.engine} is not valid for a ${input.year} ${input.make} ${input.model}`;
}
