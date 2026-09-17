import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonProfile } from './entities/person-profile.entity';
import { PassportDocument } from './entities/passport-document.entity';
import { Employee } from './entities/employee.entity';
import { PeopleService } from './people.service';
import { PeopleController } from './people.controller';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [TypeOrmModule.forFeature([PersonProfile, PassportDocument, Employee]), FilesModule],
  controllers: [PeopleController],
  providers: [PeopleService],
  exports: [PeopleService],
})
export class PeopleModule {}
