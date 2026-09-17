import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export function buildTypeOrmOptions(configService: ConfigService): TypeOrmModuleOptions {
  const nodeEnv = configService.get<string>('app.nodeEnv');

  return {
    type: 'postgres',
    host: configService.get<string>('database.host'),
    port: configService.get<number>('database.port'),
    username: configService.get<string>('database.user'),
    password: configService.get<string>('database.password'),
    database: configService.get<string>('database.name'),
    autoLoadEntities: true,
    // Migrations are the only source of schema truth - never let TypeORM
    // mutate the schema based on entity metadata, in any environment.
    synchronize: false,
    logging: nodeEnv === 'development' ? ['error', 'warn'] : ['error'],
    // A modest, explicit pool: high-load safe without starving Postgres
    // when multiple app instances run behind the same database.
    extra: {
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      // Defense in depth: if application code ever locks a row in one
      // transaction and then (by mistake) tries to touch it from a second
      // connection, Postgres fails that second query after 5s instead of
      // blocking forever and slowly starving the whole pool. Likewise no
      // single statement should legitimately run for more than 30s.
      statement_timeout: 30000,
      lock_timeout: 5000,
      idle_in_transaction_session_timeout: 30000,
    },
  };
}
