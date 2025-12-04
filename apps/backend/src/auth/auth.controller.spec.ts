import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  const mockAuthService = {
    login: jest.fn(),
    register: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should login and return tokens', async () => {
    const loginResp = {
      user: { id: '1', email: 'a@b.com', username: 'a', role: 'user' },
      accessToken: 'token',
      refreshToken: 'refresh',
    };
    mockAuthService.login.mockResolvedValue(loginResp);

    const result = await controller.login({
      emailOrUsername: 'a',
      password: 'pass',
    });
    expect(result).toEqual(loginResp);
  });

  it('should throw UnauthorizedException on invalid credentials', async () => {
    mockAuthService.login.mockRejectedValue(
      new UnauthorizedException('Invalid credentials')
    );
    await expect(
      controller.login({ emailOrUsername: 'notfound', password: 'pass' })
    ).rejects.toThrow(UnauthorizedException);
  });
});
