import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min, Max, IsOptional } from 'class-validator';

// No endpoint returns an unbounded list (OWASP API4: unrestricted resource consumption).
export const MAX_PAGE_SIZE = 100;

// Query params arrive as strings — @Type(() => Number) converts them before validation.
// Requires ValidationPipe({ transform: true }) in main.ts.
export class PaginationParamsDto {
    @ApiPropertyOptional({ description: 'Page number (starts at 1). Default: 1.', example: 2, default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "The 'page' parameter must be an integer." })
    @Min(1,  { message: "The 'page' parameter must be >= 1." })
    page: number = 1;

    @ApiPropertyOptional({ description: 'Results per page (1-100). Default: 10.', example: 20, default: 10 })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "The 'limit' parameter must be an integer." })
    @Min(1,  { message: "The 'limit' parameter must be >= 1." })
    @Max(MAX_PAGE_SIZE, { message: `The 'limit' parameter must be <= ${MAX_PAGE_SIZE}.` })
    limit: number = 10;
}
