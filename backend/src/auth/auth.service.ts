import { Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { RefreshToken } from '@prisma/client';

@Injectable()
export class AuthService {
    constructor(
        private userService: UserService,
        private jwtService: JwtService,
        private configService: ConfigService,
        private prisma: PrismaService,
    ) { }

    async validateUser(email: string, pass: string): Promise<any> {
        const normalizedEmail = email.toLowerCase();
        const user = await this.userService.findOne(normalizedEmail);
        if (user && await argon2.verify(user.password, pass)) {
            const { password, ...result } = user;
            return result;
        }
        return null;
    }

    async login(user: any) {
        const payload = { username: user.email, sub: user.id, role: user.role };
        const refreshTokenSecret = this.configService.get<string>('REFRESH_TOKEN_SECRET') || 'refresh-secret';
        const refreshTokenExpiration = this.configService.get<string>('REFRESH_TOKEN_EXPIRATION') || '7d';

        const refreshToken = this.jwtService.sign(payload, {
            secret: refreshTokenSecret,
            expiresIn: refreshTokenExpiration as any,
        });

        // Hash refresh token before storing
        const hashedToken = await argon2.hash(refreshToken);

        // Parse expiration from token or use default
        const expirationMs = refreshTokenExpiration.includes('d')
            ? parseInt(refreshTokenExpiration) * 24 * 60 * 60 * 1000
            : refreshTokenExpiration.includes('h')
                ? parseInt(refreshTokenExpiration) * 60 * 60 * 1000
                : 7 * 24 * 60 * 60 * 1000;

        // Store hashed refresh token in DB
        await this.prisma.refreshToken.create({
            data: {
                token: hashedToken,
                userId: user.id,
                expiresAt: new Date(Date.now() + expirationMs),
            },
        });

        const { password: _, ...userWithoutPassword } = user;

        return {
            access_token: this.jwtService.sign(payload),
            refresh_token: refreshToken,
            user: userWithoutPassword,
        };
    }

    async refreshToken(token: string) {
        try {
            const refreshTokenSecret = this.configService.get<string>('REFRESH_TOKEN_SECRET') || 'refresh-secret';
            const payload = this.jwtService.verify(token, { secret: refreshTokenSecret });

            // Find all tokens for this user and verify against hashed tokens
            const userTokens = await this.prisma.refreshToken.findMany({
                where: { userId: payload.sub },
            });

            let matchedToken: RefreshToken | null = null;
            for (const storedToken of userTokens) {
                try {
                    if (await argon2.verify(storedToken.token, token)) {
                        matchedToken = storedToken;
                        break;
                    }
                } catch {
                    // Continue checking other tokens
                }
            }

            if (!matchedToken) {
                throw new UnauthorizedException('Invalid refresh token');
            }

            // Check if token is expired
            if (matchedToken.expiresAt < new Date()) {
                await this.prisma.refreshToken.delete({ where: { id: matchedToken.id } });
                throw new UnauthorizedException('Refresh token expired');
            }

            // Remove old token
            await this.prisma.refreshToken.delete({ where: { id: matchedToken.id } });

            const user = await this.userService.findById(payload.sub);
            if (!user) {
                throw new UnauthorizedException('User not found');
            }

            return this.login(user);
        } catch (e) {
            if (e instanceof UnauthorizedException) {
                throw e;
            }
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    async register(data: any) {
        const normalizedEmail = data.email.toLowerCase();
        const existingUser = await this.userService.findOne(normalizedEmail);
        if (existingUser) {
            throw new ConflictException('User already exists');
        }
        const hashedPassword = await argon2.hash(data.password);
        return this.userService.create({ ...data, email: normalizedEmail, password: hashedPassword });
    }
}
