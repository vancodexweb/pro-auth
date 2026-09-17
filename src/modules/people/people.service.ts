import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PersonProfile } from './entities/person-profile.entity';
import { PassportDocument } from './entities/passport-document.entity';
import { Employee } from './entities/employee.entity';
import { EmployeeStatus } from './enums/employee-status.enum';
import { CreatePersonProfileInput } from './people.types';
import { PaginatedResult, paginate } from '../../common/dto/pagination-query.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';

export interface PersonProfileWithPassport {
  profile: PersonProfile;
  passport: PassportDocument;
}

@Injectable()
export class PeopleService {
  constructor(
    @InjectRepository(PersonProfile)
    private readonly profileRepository: Repository<PersonProfile>,
    @InjectRepository(PassportDocument)
    private readonly passportRepository: Repository<PassportDocument>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
  ) {}

  async createProfile(
    input: CreatePersonProfileInput,
    manager: EntityManager,
  ): Promise<PersonProfileWithPassport> {
    const profileRepo = manager.getRepository(PersonProfile);
    const passportRepo = manager.getRepository(PassportDocument);

    const profile = await profileRepo.save(
      profileRepo.create({
        userId: input.userId,
        lastName: input.lastName,
        firstName: input.firstName,
        middleName: input.middleName ?? null,
        birthDate: input.birthDate,
        gender: input.gender,
        birthPlace: input.birthPlace,
        countryOfResidence: input.countryOfResidence,
        countryOfRegistration: input.countryOfRegistration,
        cityOfRegistration: input.cityOfRegistration,
        street: input.street,
        registrationDate: input.registrationDate,
        facePhotoFileId: input.facePhotoFileId,
      }),
    );

    const passport = await passportRepo.save(
      passportRepo.create({
        personProfileId: profile.id,
        issuedBy: input.passport.issuedBy,
        issueDate: input.passport.issueDate,
        subdivisionCode: input.passport.subdivisionCode,
        mainPagePhotoFileId: input.passport.mainPagePhotoFileId,
        registrationPagePhotoFileId: input.passport.registrationPagePhotoFileId,
      }),
    );

    return { profile, passport };
  }

  async findByUserId(userId: string): Promise<PersonProfileWithPassport> {
    const profile = await this.profileRepository.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException('Personal profile not found');
    const passport = await this.passportRepository.findOne({
      where: { personProfileId: profile.id },
    });
    if (!passport) throw new NotFoundException('Passport document not found');
    return { profile, passport };
  }

  async createEmployee(
    userId: string,
    input: { departmentId?: string | null; position: string; hireDate: string },
    manager: EntityManager,
  ): Promise<Employee> {
    const employeeRepo = manager.getRepository(Employee);
    const employeeNumber = await this.nextEmployeeNumber(manager);
    return employeeRepo.save(
      employeeRepo.create({
        userId,
        employeeNumber,
        departmentId: input.departmentId ?? null,
        position: input.position,
        hireDate: input.hireDate,
        status: EmployeeStatus.ACTIVE,
      }),
    );
  }

  async findEmployeeByUserId(userId: string): Promise<Employee | null> {
    return this.employeeRepository.findOne({ where: { userId } });
  }

  async findAllEmployees(query: QueryEmployeesDto): Promise<PaginatedResult<Employee>> {
    const qb = this.employeeRepository.createQueryBuilder('employee');
    if (query.departmentId) {
      qb.andWhere('employee.departmentId = :departmentId', { departmentId: query.departmentId });
    }
    qb.orderBy('employee.createdAt', 'DESC').skip(query.skip).take(query.limit);
    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, query);
  }

  private async nextEmployeeNumber(manager: EntityManager): Promise<string> {
    const result = await manager.query<{ val: string }[]>(
      "SELECT nextval('employee_number_seq') as val",
    );
    const sequenceValue = result[0].val;
    return `EMP-${sequenceValue.padStart(6, '0')}`;
  }
}
