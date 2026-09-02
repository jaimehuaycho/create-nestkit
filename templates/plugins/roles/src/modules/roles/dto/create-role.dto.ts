import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateRoleDto {
    @ApiProperty({ example: 'admin', maxLength: 50 })
    @IsString()
    @IsNotEmpty({ message: 'Name is required.' })
    @MaxLength(50, { message: 'Name must not exceed 50 characters.' })
    name: string;
}
