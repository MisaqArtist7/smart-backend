import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class GetMyOrdersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'شماره صفحه باید یک عدد صحیح باشد' })
  @Min(1, { message: 'شماره صفحه باید حداقل ۱ باشد' })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'تعداد در هر صفحه باید یک عدد صحیح باشد' })
  @Min(1, { message: 'تعداد در هر صفحه باید حداقل ۱ باشد' })
  @Max(50, { message: 'حداکثر تعداد در هر صفحه ۵۰ عدد است' })
  limit: number = 10;
}
