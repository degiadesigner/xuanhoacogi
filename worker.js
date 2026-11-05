import {
  createFounderSecurityBackend,
  DEFAULT_FIREBASE_WEB_API_KEY,
} from './server/founder-security-backend.mjs';

const backendInstancesByKey = new Map();

function getBackendForEnv(env = {}) {
  const projectId = env.VITE_FIREBASE_PROJECT_ID || 'xuanhoacogi';
  const rtdbUrl = (
    env.FIREBASE_DATABASE_EMULATOR_URL ||
    env.VITE_FIREBASE_DATABASE_URL ||
    'https://xuanhoacogi-default-rtdb.firebaseio.com'
  ).replace(/\/$/, '');
  const rtdbNamespace = env.FIREBASE_DATABASE_NAMESPACE || 'xuanhoacogi-default-rtdb';
  const firebaseApiKey = env.VITE_FIREBASE_API_KEY || DEFAULT_FIREBASE_WEB_API_KEY;
  const serviceAccountJson = env.FIREBASE_SERVICE_ACCOUNT_JSON || '';
  const firebaseAccessToken = env.FIREBASE_ACCESS_TOKEN || '';
  const firebaseDatabaseSecret = env.FIREBASE_DATABASE_SECRET || '';
  const emulatorOwnerToken = env.FIREBASE_EMULATOR_OWNER_TOKEN || 'owner';
  const allowEmulatorTokens =
    env.ALLOW_EMULATOR_TOKENS !== undefined
      ? env.ALLOW_EMULATOR_TOKENS === true || String(env.ALLOW_EMULATOR_TOKENS) === 'true'
      : rtdbUrl.includes('127.0.0.1') || rtdbUrl.includes('localhost');

  const cacheKey = `${projectId}|${rtdbUrl}|${rtdbNamespace}|${allowEmulatorTokens}|${Boolean(serviceAccountJson)}|${Boolean(firebaseDatabaseSecret)}`;
  let instance = backendInstancesByKey.get(cacheKey);
  if (!instance) {
    instance = createFounderSecurityBackend({
      projectId,
      rtdbUrl,
      rtdbNamespace,
      firebaseApiKey,
      serviceAccountJson,
      firebaseAccessToken,
      firebaseDatabaseSecret,
      emulatorOwnerToken,
      allowEmulatorTokens,
    });
    backendInstancesByKey.set(cacheKey, instance);
  }
  return instance;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/founder-security/')) {
      const backend = getBackendForEnv(env);
      const response = await backend.handleFetchRequest(request);
      if (response) return response;
    }
    if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }
    return new Response('Not Found', { status: 404 });
  },
};
