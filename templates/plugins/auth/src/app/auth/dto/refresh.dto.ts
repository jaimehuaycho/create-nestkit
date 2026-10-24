import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshDto {
    @ApiProperty({
        example:     'q3Zx0e9y5pQ2m8Jt1VbN7aLkR4sWcU6hDfGiOeXnYzA',
        description: 'Opaque refresh token received from the last successful login, register or refresh. Single use.',
    })
    @IsString()
    @IsNotEmpty({ message: 'Refresh token is required.' })
    refreshToken: string;
}
