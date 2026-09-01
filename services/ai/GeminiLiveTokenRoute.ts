import type { Request, RequestHandler, Response } from 'express';
import { issueOneUseTrackCoachTokenFromEnvironment } from './GeminiLiveTokenService';

export interface GeminiLiveTokenRouteDependencies {
    verifyBearerToken: (token: string) => Promise<{ uid: string }>;
    issueToken?: typeof issueOneUseTrackCoachTokenFromEnvironment;
}

function getBearerToken(request: Request): string | null {
    const authorization = request.header('authorization');
    if (!authorization?.startsWith('Bearer ')) return null;
    const token = authorization.slice('Bearer '.length).trim();
    return token || null;
}

export function createGeminiLiveTokenHandler(
    dependencies: GeminiLiveTokenRouteDependencies,
): RequestHandler {
    return async (request: Request, response: Response) => {
        const bearerToken = getBearerToken(request);
        if (!bearerToken) {
            response.status(401).json({ error: 'Authentication required.' });
            return;
        }

        try {
            await dependencies.verifyBearerToken(bearerToken);
        } catch {
            response.status(401).json({ error: 'Invalid application session.' });
            return;
        }

        try {
            const issueToken = dependencies.issueToken ?? issueOneUseTrackCoachTokenFromEnvironment;
            const token = await issueToken();
            response.setHeader('Cache-Control', 'no-store');
            response.status(200).json(token);
        } catch (error) {
            console.error('[GeminiLiveToken] Token issuance failed.', error);
            response.status(503).json({ error: 'Live coaching is temporarily unavailable.' });
        }
    };
}

export async function verifyFirebaseBearerToken(token: string): Promise<{ uid: string }> {
    const [{ getApps, initializeApp }, { getAuth }] = await Promise.all([
        import('firebase-admin/app'),
        import('firebase-admin/auth'),
    ]);
    const app = getApps()[0] ?? initializeApp();
    const decoded = await getAuth(app).verifyIdToken(token, true);
    return { uid: decoded.uid };
}

