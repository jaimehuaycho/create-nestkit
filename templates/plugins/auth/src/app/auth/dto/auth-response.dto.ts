import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from '../../../modules/users/dto/user.dto.js';

export class AuthResponseDto {
    @ApiProperty({
        example:     'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        description: 'Short-lived access token (JWT_TIME_EXPIRE, default 15 min). Send as Authorization: Bearer <token> on every request.',
    })
    accessToken: string;

    @ApiProperty({ example: 900, description: 'Seconds until the access token expires.' })
    expiresIn: number;

    @ApiProperty({
        example:     'q3Zx0e9y5pQ2m8Jt1VbN7aLkR4sWcU6hDfGiOeXnYzA',
        description: 'Opaque, single-use refresh token (REFRESH_TOKEN_TTL, default 7 days, within REFRESH_FAMILY_TTL). Use only at POST /auth/refresh. Store securely.',
    })
    refreshToken: string;

    @ApiProperty({ type: UserDto })
    user: UserDto;
}
