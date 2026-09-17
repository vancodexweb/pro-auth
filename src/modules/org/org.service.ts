import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from './entities/department.entity';
import { CostCenter } from './entities/cost-center.entity';
import { Project } from './entities/project.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { CreateCostCenterDto } from './dto/create-cost-center.dto';
import { CreateProjectDto } from './dto/create-project.dto';

/**
 * Organizational dimensions (departments, cost centers, projects) used
 * across budgeting, expense requests, and ledger postings. Deliberately
 * simple CRUD - the interesting logic lives in the modules that consume
 * these as dimensions, not here.
 */
@Injectable()
export class OrgService {
  constructor(
    @InjectRepository(Department) private readonly departmentRepository: Repository<Department>,
    @InjectRepository(CostCenter) private readonly costCenterRepository: Repository<CostCenter>,
    @InjectRepository(Project) private readonly projectRepository: Repository<Project>,
  ) {}

  async createDepartment(dto: CreateDepartmentDto): Promise<Department> {
    await this.assertDepartmentCodeFree(dto.code);
    return this.departmentRepository.save(this.departmentRepository.create(dto));
  }

  findAllDepartments(): Promise<Department[]> {
    return this.departmentRepository.find({ order: { name: 'ASC' } });
  }

  async findDepartmentById(id: string): Promise<Department> {
    const department = await this.departmentRepository.findOne({ where: { id } });
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  async createCostCenter(dto: CreateCostCenterDto): Promise<CostCenter> {
    const existing = await this.costCenterRepository.findOne({ where: { code: dto.code } });
    if (existing) throw new ConflictException(`Cost center code "${dto.code}" already exists`);
    if (dto.departmentId) {
      await this.findDepartmentById(dto.departmentId);
    }
    return this.costCenterRepository.save(this.costCenterRepository.create(dto));
  }

  findAllCostCenters(): Promise<CostCenter[]> {
    return this.costCenterRepository.find({ order: { name: 'ASC' } });
  }

  async findCostCenterById(id: string): Promise<CostCenter> {
    const costCenter = await this.costCenterRepository.findOne({ where: { id } });
    if (!costCenter) throw new NotFoundException('Cost center not found');
    return costCenter;
  }

  async createProject(dto: CreateProjectDto): Promise<Project> {
    const existing = await this.projectRepository.findOne({ where: { code: dto.code } });
    if (existing) throw new ConflictException(`Project code "${dto.code}" already exists`);
    return this.projectRepository.save(this.projectRepository.create(dto));
  }

  findAllProjects(): Promise<Project[]> {
    return this.projectRepository.find({ order: { name: 'ASC' } });
  }

  async findProjectById(id: string): Promise<Project> {
    const project = await this.projectRepository.findOne({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  private async assertDepartmentCodeFree(code: string): Promise<void> {
    const existing = await this.departmentRepository.findOne({ where: { code } });
    if (existing) throw new ConflictException(`Department code "${code}" already exists`);
  }
}
