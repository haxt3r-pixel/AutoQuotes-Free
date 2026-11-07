import { Router, type Request, type Response } from 'express';
import { customersRepo } from '../database/repositories/customers.repo.js';
import { customerSchema, customerUpdateSchema, vehicleSchema } from '../validation/schemas.js';

const router = Router();

/** GET /api/customers — list/search customers */
router.get('/', (req: Request, res: Response) => {
  const { search, limit, offset } = req.query;
  if (search && typeof search === 'string') {
    const results = customersRepo.searchCustomers(
      search,
      limit ? parseInt(limit as string, 10) : 20,
    );
    res.json({ success: true, data: results });
    return;
  }
  const customers = customersRepo.listCustomers(
    limit ? parseInt(limit as string, 10) : 100,
    offset ? parseInt(offset as string, 10) : 0,
  );
  res.json({ success: true, data: customers });
});

/** POST /api/customers — create customer */
router.post('/', (req: Request, res: Response) => {
  const data = customerSchema.parse(req.body);
  const customer = customersRepo.createCustomer(data);
  res.status(201).json({ success: true, data: customer });
});

/** GET /api/customers/:id */
router.get('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const customer = customersRepo.getCustomerById(id);
  if (!customer) {
    res.status(404).json({ success: false, error: 'not_found', message: 'Customer not found' });
    return;
  }
  res.json({ success: true, data: customer });
});

/** PUT /api/customers/:id */
router.put('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (!customersRepo.getCustomerById(id)) {
    res.status(404).json({ success: false, error: 'not_found', message: 'Customer not found' });
    return;
  }
  const data = customerUpdateSchema.parse(req.body);
  customersRepo.updateCustomer(id, data);
  res.json({ success: true, data: customersRepo.getCustomerById(id) });
});

// ── Vehicles ──

/** GET /api/customers/:id/vehicles */
router.get('/:id/vehicles', (req: Request, res: Response) => {
  const customerId = parseInt(req.params.id, 10);
  const vehicles = customersRepo.getVehiclesByCustomer(customerId);
  res.json({ success: true, data: vehicles });
});

/** POST /api/customers/:id/vehicles */
router.post('/:id/vehicles', (req: Request, res: Response) => {
  const customerId = parseInt(req.params.id, 10);
  if (!customersRepo.getCustomerById(customerId)) {
    res.status(404).json({ success: false, error: 'not_found', message: 'Customer not found' });
    return;
  }
  const data = vehicleSchema.parse(req.body);
  const vehicle = customersRepo.createVehicle({ ...data, customer_id: customerId });
  res.status(201).json({ success: true, data: vehicle });
});

export default router;