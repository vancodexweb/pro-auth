import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Gender } from '../enums/gender.enum';

/**
 * One row per registered account. `userId` is a plain column (no relation)
 * on purpose: People must not import the Auth module's User entity, so the
 * two bounded contexts stay decoupled and referential integrity is instead
 * enforced by a foreign key added in the migration.
 */
@Entity('person_profiles')
export class PersonProfile extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  middleName: string | null;

  @Column({ type: 'date' })
  birthDate: string;

  @Column({ type: 'enum', enum: Gender })
  gender: Gender;

  @Column({ type: 'varchar', length: 255 })
  birthPlace: string;

  @Column({ type: 'varchar', length: 100 })
  countryOfResidence: string;

  @Column({ type: 'varchar', length: 100 })
  countryOfRegistration: string;

  @Column({ type: 'varchar', length: 100 })
  cityOfRegistration: string;

  @Column({ type: 'varchar', length: 255 })
  street: string;

  @Column({ type: 'date' })
  registrationDate: string;

  @Column({ type: 'uuid' })
  facePhotoFileId: string;
}
