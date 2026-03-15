import { IsString, IsEnum, MinLength, IsOptional, ValidateIf } from 'class-validator';
import { SearchType } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSearchDto {
    @ApiProperty({
        description: 'The search query (e.g., name, email, handle). Optional for IMAGE searches.',
        example: 'john.doe@example.com',
        required: false,
    })
    @ValidateIf((o) => o.type !== SearchType.IMAGE)
    @IsString()
    @MinLength(3)
    query?: string;

    @ApiProperty({
        description: 'The type of search to perform',
        enum: SearchType,
        default: SearchType.PRELIMINARY,
    })
    @IsEnum(SearchType)
    type: SearchType = SearchType.PRELIMINARY;

    @ApiProperty({
        description: 'URL of uploaded image (for IMAGE search type)',
        example: 'https://minio.example.com/images/user123/image.jpg',
        required: false,
    })
    @ValidateIf((o) => o.type === SearchType.IMAGE)
    @IsString()
    @IsOptional()
    imageUrl?: string;

    @ApiProperty({
        description: 'Selected profile from preliminary search for focused deep search',
        example: { 
            platform: 'Instagram', 
            username: 'johndoe', 
            url: 'https://instagram.com/johndoe',
            persona: {
                type: 'developer',
                profession: 'Senior Software Engineer',
                location: 'Romania',
                interests: ['Python', 'React', 'Cloud']
            }
        },
        required: false,
    })
    @IsOptional()
    selectedProfile?: {
        platform: string;
        username: string;
        url: string;
        persona?: {
            type: string;
            profession: string;
            location: string;
            interests: string[];
        };
    };
}
