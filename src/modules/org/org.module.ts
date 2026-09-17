import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from './entities/department.entity';
import { CostCenter } from './entities/cost-center.entity';
import { Project } from './entities/project.entity';
import { OrgService } from './org.service';
import { OrgController } from './org.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Department, CostCenter, Project])],
  controllers: [OrgController],
  providers: [OrgService],
  exports: [OrgService],
})
export class OrgModule {}
