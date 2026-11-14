import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class ValidateDiscountDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsInt()
  @Min(0)
  cartAmount: number;
}

