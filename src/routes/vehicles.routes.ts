import { Router, type Request, type Response } from 'express';
import { vehiclesRepo } from '../database/repositories/vehicles.repo.js';
import { vehicleSchema, vehicleUpdateSchema } from '../validation/schemas.js';
import {
  getMakes, getModels, getTrims, getTrimNames, getModelYearRange,
  getTrimDetail, getEngines, getDrivetrains,
  validateCatalogVehicle,
} from '../core/catalog.service.js';

const router = Router();

// ═══ Vehicle Catalog Endpoints (cascading dropdowns) ═══

/** GET /api/vehicles/catalog/makes — list all makes */
router.get('/catalog/makes', (_req: Request, res: Response) => {
  res.json({ success: true, data: getMakes() });
});

/** GET /api/vehicles/catalog/models/:make — list models for a make */
router.get('/catalog/models/:make', (req: Request, res: Response) => {
  const { make } = req.params;
  const year = req.query.year ? parseInt(String(req.query.year), 10) : undefined;
  const models = getModels(make).filter(model =>
    !year || (year >= model.years[0] && year <= model.years[model.years.length - 1]),
  );
  const result = models.map(m => ({
    model: m.model,
    yearRange: m.years.length >= 2 ? [m.years[0], m.years[m.years.length - 1]] : null,
    trimCount: m.trims.length,
  }));
  res.json({ success: true, data: result });
});

/** GET /api/vehicles/catalog/trims/:make/:model — list trim names for a model */
router.get('/catalog/trims/:make/:model', (req: Request, res: Response) => {
  const { make, model } = req.params;
  const year = req.query.year ? parseInt(String(req.query.year), 10) : undefined;
  const trims = getTrimNames(make, model, year);
  res.json({ success: true, data: trims });
});

/** GET /api/vehicles/catalog/trim-detail/:make/:model/:trim — get full trim details */
router.get('/catalog/trim-detail/:make/:model/:trim', (req: Request, res: Response) => {
  const { make, model, trim } = req.params;
  const year = req.query.year ? parseInt(String(req.query.year), 10) : undefined;
  const detail = getTrimDetail(make, model, trim, year);
  if (!detail) {
    res.status(404).json({ success: false, error: 'not_found', message: 'Trim not found' });
    return;
  }
  res.json({ success: true, data: detail });
});

/** GET /api/vehicles/catalog/engines/:make/:model/:trim — engines for a trim */
router.get('/catalog/engines/:make/:model/:trim', (req: Request, res: Response) => {
  const { make, model, trim } = req.params;
  const year = req.query.year ? parseInt(String(req.query.year), 10) : undefined;
  const engines = getEngines(make, model, trim, year);
  res.json({ success: true, data: engines });
});

/** GET /api/vehicles/catalog/drivetrains/:make/:model/:trim — drivetrains for a trim */
router.get('/catalog/drivetrains/:make/:model/:trim', (req: Request, res: Response) => {
  const { make, model, trim } = req.params;
  const year = req.query.year ? parseInt(String(req.query.year), 10) : undefined;
  const engine = typeof req.query.engine === 'string' ? req.query.engine : undefined;
  const drivetrains = getDrivetrains(make, model, trim, year, engine);
  res.json({ success: true, data: drivetrains });
});

/** GET /api/vehicles/catalog/year-range/:make/:model */
router.get('/catalog/year-range/:make/:model', (req: Request, res: Response) => {
  const { make, model } = req.params;
  const range = getModelYearRange(make, model);
  res.json({ success: true, data: range });
});

/** GET /api/vehicles — list vehicles */
router.get('/', (req: Request, res: Response) => {
  const { customer_id, limit } = req.query;
  const vehicles = vehiclesRepo.listVehicles({
    customer_id: customer_id ? parseInt(customer_id as string, 10) : undefined,
    limit: limit ? parseInt(limit as string, 10) : undefined,
  });
  res.json({ success: true, data: vehicles });
});

/** GET /api/vehicles/:id — get single vehicle */
router.get('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const vehicle = vehiclesRepo.getVehicleById(id);
  if (!vehicle) {
    res.status(404).json({ success: false, error: 'not_found', message: 'Vehicle not found' });
    return;
  }
  res.json({ success: true, data: vehicle });
});

/** POST /api/vehicles — create vehicle */
router.post('/', (req: Request, res: Response) => {
  const data = vehicleSchema.parse(req.body);
  const catalogError = validateCatalogVehicle(data);
  if (catalogError) {
    res.status(400).json({ success: false, error: 'invalid_vehicle', message: catalogError });
    return;
  }
  const vehicle = vehiclesRepo.createVehicle(data);
  res.status(201).json({ success: true, data: vehicle });
});

/** PUT /api/vehicles/:id — update vehicle */
router.put('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (!vehiclesRepo.getVehicleById(id)) {
    res.status(404).json({ success: false, error: 'not_found', message: 'Vehicle not found' });
    return;
  }
  const data = vehicleUpdateSchema.parse(req.body);
  const existing = vehiclesRepo.getVehicleById(id)!;
  const catalogError = validateCatalogVehicle({ ...existing, ...data });
  if (catalogError) {
    res.status(400).json({ success: false, error: 'invalid_vehicle', message: catalogError });
    return;
  }
  const vehicle = vehiclesRepo.updateVehicle(id, data);
  if (!vehicle) {
    res.status(404).json({ success: false, error: 'not_found', message: 'Vehicle not found' });
    return;
  }
  res.json({ success: true, data: vehicle });
});

/** DELETE /api/vehicles/:id */
router.delete('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const deleted = vehiclesRepo.deleteVehicle(id);
  if (!deleted) {
    res.status(404).json({ success: false, error: 'not_found', message: 'Vehicle not found' });
    return;
  }
  res.json({ success: true, data: { deleted: true } });
});

/** GET /api/vehicles/:id/summary — get formatted summary string */
router.get('/:id/summary', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const vehicle = vehiclesRepo.getVehicleById(id);
  if (!vehicle) {
    res.status(404).json({ success: false, error: 'not_found', message: 'Vehicle not found' });
    return;
  }
  res.json({ success: true, data: { summary: vehiclesRepo.getVehicleSummary(vehicle) } });
});

export default router;
