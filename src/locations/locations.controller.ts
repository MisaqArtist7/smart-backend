import {
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { LocationsService } from './locations.service.js';

@Public()
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('provinces')
  @Header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
  async getActiveProvinces() {
    return this.locationsService.getActiveProvinces();
  }

  @Get('provinces/:provinceId/cities')
  @Header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
  async getActiveCitiesByProvince(
    @Param('provinceId', ParseIntPipe) provinceId: number,
  ) {
    return this.locationsService.getActiveCitiesByProvince(provinceId);
  }
}
