import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class CreateResearchDto {
  @IsString()
  query: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  maxIterations?: number;
}
