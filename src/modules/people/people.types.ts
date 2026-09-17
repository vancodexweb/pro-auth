import { Gender } from './enums/gender.enum';

/** Input shape for creating a profile; the Auth module's RegisterDto matches this. */
export interface CreatePersonProfileInput {
  userId: string;
  lastName: string;
  firstName: string;
  middleName?: string | null;
  birthDate: string;
  gender: Gender;
  birthPlace: string;
  countryOfResidence: string;
  countryOfRegistration: string;
  cityOfRegistration: string;
  street: string;
  registrationDate: string;
  facePhotoFileId: string;
  passport: {
    issuedBy: string;
    issueDate: string;
    subdivisionCode: string;
    mainPagePhotoFileId: string;
    registrationPagePhotoFileId: string;
  };
}
