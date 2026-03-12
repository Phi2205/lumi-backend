import { IsOptional, IsObject } from 'class-validator';

export class GetSignatureDto {
    @IsOptional()
    @IsObject()
    params?: Record<string, any>;
}
