import * as dotenv from 'dotenv';
import * as path from 'node:path';

// Populate process.env from .env.test BEFORE the app (and its
// ConfigModule.forRoot(), which also calls dotenv but never overwrites an
// already-set variable) is imported by any test file.
dotenv.config({ path: path.join(__dirname, '..', '.env.test') });
