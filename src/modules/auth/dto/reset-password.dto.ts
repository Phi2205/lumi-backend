import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ example: '123456' })
    @IsNotEmpty()
    @IsString()
    otp: string;

    @ApiProperty({ example: 'newPassword123' })
    @IsNotEmpty()
    @IsString()
    @MinLength(6)
    newPassword: string;
}
