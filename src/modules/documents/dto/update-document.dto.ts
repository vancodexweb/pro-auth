import { PartialType } from '@nestjs/swagger';
import { CreateDocumentDto } from './create-document.dto';

/** Only reachable while the document is DRAFT or REJECTED (see DocumentsService.update). */
export class UpdateDocumentDto extends PartialType(CreateDocumentDto) {}
