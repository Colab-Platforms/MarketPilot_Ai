import { SetMetadata } from '@nestjs/common';

export const ALLOW_UNVERIFIED_KEY = 'allowUnverified';

// Routes an account may call before its email is verified (verification itself, /me).
export const AllowUnverified = (): MethodDecorator & ClassDecorator => SetMetadata(ALLOW_UNVERIFIED_KEY, true);
