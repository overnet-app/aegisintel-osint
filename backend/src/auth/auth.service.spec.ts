import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';

describe('AuthService', () => {
    let service: AuthService;
    let userService: UserService;
    let jwtService: JwtService;
    let prismaService: PrismaService;

    const mockUser = {
        id: '1',
        email: 'test@example.com',
        password: 'hashedPassword',
        role: 'ANALYST',
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: UserService,
                    useValue: {
                        findOne: jest.fn(),
                        findById: jest.fn(),
                        create: jest.fn(),
                    },
                },
                {
                    provide: JwtService,
                    useValue: {
                        sign: jest.fn().mockReturnValue('mockToken'),
                        verify: jest.fn(),
                    },
                },
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string) => {
                            if (key === 'REFRESH_TOKEN_SECRET') return 'refresh-secret';
                            if (key === 'REFRESH_TOKEN_EXPIRATION') return '7d';
                            return null;
                        }),
                    },
                },
                {
                    provide: PrismaService,
                    useValue: {
                        refreshToken: {
                            create: jest.fn(),
                            findMany: jest.fn(),
                            delete: jest.fn(),
                        },
                    },
                },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
        userService = module.get<UserService>(UserService);
        jwtService = module.get<JwtService>(JwtService);
        prismaService = module.get<PrismaService>(PrismaService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('validateUser', () => {
        it('should return user without password when credentials are valid', async () => {
            jest.spyOn(userService, 'findOne').mockResolvedValue(mockUser as any);
            jest.spyOn(argon2, 'verify').mockResolvedValue(true);

            const result = await service.validateUser('test@example.com', 'password');

            expect(result).toEqual({
                id: '1',
                email: 'test@example.com',
                role: 'ANALYST',
            });
            expect(result.password).toBeUndefined();
        });

        it('should return null when credentials are invalid', async () => {
            jest.spyOn(userService, 'findOne').mockResolvedValue(mockUser as any);
            jest.spyOn(argon2, 'verify').mockResolvedValue(false);

            const result = await service.validateUser('test@example.com', 'wrongpassword');

            expect(result).toBeNull();
        });
    });

    describe('register', () => {
        it('should create a new user with hashed password', async () => {
            const newUser = {
                email: 'new@example.com',
                password: 'password123',
            };

            jest.spyOn(userService, 'findOne').mockResolvedValue(null);
            jest.spyOn(userService, 'create').mockResolvedValue({ ...newUser, id: '2' } as any);
            jest.spyOn(argon2, 'hash').mockResolvedValue('hashedPassword');

            const result = await service.register(newUser);

            expect(argon2.hash).toHaveBeenCalledWith('password123');
            expect(userService.create).toHaveBeenCalledWith({
                ...newUser,
                email: 'new@example.com',
                password: 'hashedPassword',
            });
        });
    });
});
