import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { User } from '../schemas/user.schema';
import { UnauthorizedException } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

describe('AuthService', () => {
  let service: AuthService;
  const mockJwtService = { signAsync: jest.fn().mockResolvedValue('token') };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        {
          provide: getModelToken(User.name),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should login user when credentials valid', async () => {
    const mockUser = {
      _id: '507f1f77bcf86cd799439011',
      email: 'test@example.com',
      username: 'testuser',
      role: 'user',
      comparePassword: jest.fn().mockResolvedValue(true),
    } as any;

    const model = (service as any).userModel;
    model.findOne.mockResolvedValue(mockUser);

    const result = await firstValueFrom(
      service.login({
        emailOrUsername: 'test@example.com',
        password: 'password',
      })
    );
    expect(result).toHaveProperty('accessToken');
    expect(result.user.email).toBe('test@example.com');
  });

  it('should throw UnauthorizedException when user not found', async () => {
    const model = (service as any).userModel;
    model.findOne.mockResolvedValue(null);

    await expect(
      firstValueFrom(
        service.login({
          emailOrUsername: 'notfound@example.com',
          password: 'password',
        })
      )
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when password invalid', async () => {
    const mockUser = {
      _id: '507f1f77bcf86cd799439011',
      email: 'test@example.com',
      username: 'testuser',
      role: 'user',
      comparePassword: jest.fn().mockResolvedValue(false),
    } as any;

    const model = (service as any).userModel;
    model.findOne.mockResolvedValue(mockUser);

    await expect(
      firstValueFrom(
        service.login({
          emailOrUsername: 'test@example.com',
          password: 'wrongpassword',
        })
      )
    ).rejects.toThrow(UnauthorizedException);
  });

  it('validateSession should not return password field', async () => {
    const mockUser = {
      _id: '507f1f77bcf86cd799439011',
      email: 'test@example.com',
      username: 'testuser',
      role: 'user',
      password: '$2b$10$hash',
    } as any;

    const model = (service as any).userModel;
    model.findById = jest.fn().mockResolvedValue(mockUser);

    const result = await firstValueFrom(
      service.validateSession('507f1f77bcf86cd799439011')
    );
    expect(result).toBeTruthy();
    expect((result as any).password).toBeUndefined();
    // Non-null assertion since we asserted above
    expect(result!.email).toBe(mockUser.email);
  });
});
