import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Used only by the TypeORM CLI (migration:generate/run/revert), outside of
 * Nest's DI container. The running application builds its own connection
 * options in database/typeorm.config.ts from validated ConfigService values;
 * this file is kept in sync with it by hand since the CLI cannot use Nest DI.
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: [__dirname + '/../modules/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development' ? ['error', 'warn', 'schema'] : ['error'],
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
