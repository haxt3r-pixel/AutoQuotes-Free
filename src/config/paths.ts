import path from 'path';
import { fileURLToPath } from 'url';

// Source and compiled layouts both place this file two levels below the app root.
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const runtimeRoot = process.env.AUTOQUOTES_DATA_DIR
  ? path.resolve(process.env.AUTOQUOTES_DATA_DIR)
  : appRoot;

export const DATA_DIR = path.join(runtimeRoot, 'data');
export const UPLOADS_DIR = path.join(runtimeRoot, 'uploads');
export const EXPORTS_DIR = path.join(runtimeRoot, 'exports');
