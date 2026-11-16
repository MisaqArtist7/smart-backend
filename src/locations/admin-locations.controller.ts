import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/client.js';
import { LocationsService } from './locations.service.js';
import { UpdateLocationStatusDto } from './dto/update-location-status.dto.js';

@Roles(Role.ADMIN)
@Controller('admin/locations')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class AdminLocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('provinces')
  async getProvinces() {
    return this.locationsService.adminGetProvinces();
  }

  @Get('provinces/:provinceId/cities')
  async getCitiesByProvince(
    @Param('provinceId', ParseIntPipe) provinceId: number,
  ) {
    return this.locationsService.adminGetCitiesByProvince(provinceId);
  }

  @Patch('provinces/:id')
  async updateProvinceStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLocationStatusDto,
  ) {
    return this.locationsService.adminUpdateProvinceStatus(id, dto.isActive);
  }

  @Patch('cities/:id')
  async updateCityStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLocationStatusDto,
  ) {
    return this.locationsService.adminUpdateCityStatus(id, dto.isActive);
  }
}
