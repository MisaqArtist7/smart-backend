import { Injectable } from '@nestjs/common';
import { AuthDto } from './dto/auth.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ForbiddenException } from '@nestjs/common';
@Injectable()
export class AuthService {
    constructor(private prisma: PrismaService) {}

    async register(dto : AuthDto) {
        const existing = await this.prisma.user.findUnique({
            where: { phone: dto.phone },
        })

        if (existing) {
            throw new ForbiddenException('User already exists');
        }
        const user = await this.prisma.user.create({
            data: { phone: dto.phone, name: dto.name },
        });

        return user;
    }

}
