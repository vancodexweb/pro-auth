import { Column, Entity, Index, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { PersonProfile } from './person-profile.entity';

@Entity('passport_documents')
export class PassportDocument extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'uuid' })
  personProfileId: string;

  @OneToOne(() => PersonProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'personProfileId' })
  personProfile?: PersonProfile;

  @Column({ type: 'varchar', length: 255 })
  issuedBy: string;

  @Column({ type: 'date' })
  issueDate: string;

  @Column({ type: 'varchar', length: 20 })
  subdivisionCode: string;

  @Column({ type: 'uuid' })
  mainPagePhotoFileId: string;

  @Column({ type: 'uuid' })
  registrationPagePhotoFileId: string;
}
