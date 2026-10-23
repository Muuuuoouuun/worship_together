import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';

// Tests own their SQLite database and use the existing development-only login.
// Real provider keys and any inherited application database are not used.
const directory = mkdtempSync(join(tmpdir(), 'worship-e2e-'));
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', '4100', '--hostname', '127.0.0.1'], {
    stdio: 'inherit',
    env: {
        ...process.env, NODE_ENV: 'development', DEV_LOGIN: '1',
        NEXTAUTH_URL: 'http://localhost:4100', NEXTAUTH_SECRET: randomBytes(32).toString('hex'),
        TEAM_DATABASE_PATH: join(directory, 'teams.sqlite'), NEXT_DIST_DIR: '.next-e2e',
        GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', NAVER_CLIENT_ID: '', NAVER_CLIENT_SECRET: '',
        NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_ANON_KEY: '', NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY: '',
    },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => { rmSync(directory, { recursive: true, force: true }); process.exit(code ?? 0); });

child.on('error', error => { rmSync(directory, { recursive: true, force: true }); console.error(error.message); process.exit(1); });
