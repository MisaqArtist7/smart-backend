import { IsBoolean } from 'class-validator';

export class UpdateLocationStatusDto {
  @IsBoolean({ message: 'وضعیت فعال بودن باید مقدار بولی (true/false) باشد' })
  isActive: boolean;
}
