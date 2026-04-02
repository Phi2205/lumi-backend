import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
    @ApiProperty({ example: 'oldPassword123' })
    @IsNotEmpty()
    @IsString()
    oldPassword: string;

    @ApiProperty({ example: 'newPassword123' })
    @IsNotEmpty()
    @IsString()
    @MinLength(6)
    newPassword: string;
}
