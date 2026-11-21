import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { Role } from '../generated/prisma/client.js';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      user: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };
    service = new UsersService(prisma);
  });

  it('1. findAll باید لیست تمام کاربران را برگرداند', async () => {
    const mockUsers = [
      { id: 1, name: 'مدیر اصلی', phone: '09121111111', role: Role.ADMIN, isActive: true },
      { id: 2, name: 'مشتری ۱', phone: '09122222222', role: Role.CUSTOMER, isActive: true },
    ];
    prisma.user.findMany.mockResolvedValue(mockUsers);

    const result = await service.findAll();
    expect(result).toEqual(mockUsers);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('2. findOne اگر کاربر وجود نداشته باشد باید NotFoundException بدهد', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('3. findOne کاربر موجود را با مشخصات کامل بازمی‌گرداند', async () => {
    const mockUser = { id: 1, name: 'تست', phone: '09123456789', role: Role.CUSTOMER };
    prisma.user.findUnique.mockResolvedValue(mockUser);

    const result = await service.findOne(1);
    expect(result).toEqual(mockUser);
  });

  it('4. تغییر نقش کاربر دیگر به ADMIN باید با موفقیت انجام شود', async () => {
    const targetUser = { id: 2, name: 'مشتری ۱', phone: '09122222222', role: Role.CUSTOMER, isActive: true };
    prisma.user.findUnique.mockResolvedValue(targetUser);
    prisma.user.update.mockResolvedValue({ ...targetUser, role: Role.ADMIN });

    const result = await service.updateUser(2, { role: Role.ADMIN }, 1);
    expect(result.role).toBe(Role.ADMIN);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 2 },
        data: expect.objectContaining({ role: Role.ADMIN }),
      }),
    );
  });

  it('5. ادمین نباید بتواند نقش ADMIN خودش را به CUSTOMER تغییر دهد', async () => {
    const adminUser = { id: 1, name: 'مدیر', phone: '09121111111', role: Role.ADMIN, isActive: true };
    prisma.user.findUnique.mockResolvedValue(adminUser);

    await expect(
      service.updateUser(1, { role: Role.CUSTOMER }, 1),
    ).rejects.toThrow(BadRequestException);
  });

  it('6. اگر شماره تلفن جدید تکراری باشد باید ConflictException دهد', async () => {
    const userToEdit = { id: 2, name: 'کاربر ۲', phone: '09122222222', role: Role.CUSTOMER };
    const anotherUser = { id: 3, name: 'کاربر ۳', phone: '09123333333', role: Role.CUSTOMER };

    prisma.user.findUnique
      .mockResolvedValueOnce(userToEdit)
      .mockResolvedValueOnce(anotherUser);

    await expect(
      service.updateUser(2, { phone: '09123333333' }, 1),
    ).rejects.toThrow(ConflictException);
  });
});
