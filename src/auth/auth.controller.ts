import { Body, Controller, Post } from '@nestjs/common';
import { AuthDto } from './dto/auth.dto.js';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
    constructor(private authService : AuthService) {}

    @Post('register')
    register(@Body() data: AuthDto) {
        return this.authService.register(data);
    }
}
