import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OrgService } from './org.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { CreateCostCenterDto } from './dto/create-cost-center.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/constants/permissions.constant';

@ApiTags('org')
@ApiBearerAuth('access-token')
@Controller('org')
export class OrgController {
  constructor(private readonly orgService: OrgService) {}

  @Post('departments')
  @RequirePermissions(Permission.ORG_MANAGE)
  createDepartment(@Body() dto: CreateDepartmentDto) {
    return this.orgService.createDepartment(dto);
  }

  @Get('departments')
  findAllDepartments() {
    return this.orgService.findAllDepartments();
  }

  @Get('departments/:id')
  findDepartment(@Param('id', ParseUUIDPipe) id: string) {
    return this.orgService.findDepartmentById(id);
  }

  @Post('cost-centers')
  @RequirePermissions(Permission.ORG_MANAGE)
  createCostCenter(@Body() dto: CreateCostCenterDto) {
    return this.orgService.createCostCenter(dto);
  }

  @Get('cost-centers')
  findAllCostCenters() {
    return this.orgService.findAllCostCenters();
  }

  @Get('cost-centers/:id')
  findCostCenter(@Param('id', ParseUUIDPipe) id: string) {
    return this.orgService.findCostCenterById(id);
  }

  @Post('projects')
  @RequirePermissions(Permission.ORG_MANAGE)
  createProject(@Body() dto: CreateProjectDto) {
    return this.orgService.createProject(dto);
  }

  @Get('projects')
  findAllProjects() {
    return this.orgService.findAllProjects();
  }

  @Get('projects/:id')
  findProject(@Param('id', ParseUUIDPipe) id: string) {
    return this.orgService.findProjectById(id);
  }
}
