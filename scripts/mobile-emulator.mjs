import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const command = process.argv[2] ?? 'sync';
if (!['sync', 'run'].includes(command)) throw new Error('Use sync or run.');
const require = createRequire(import.meta.url);
const cli = join(dirname(require.resolve('@capacitor/cli/package.json')), 'bin/capacitor');
const env = { ...process.env, CAPACITOR_SERVER_URL: process.env.CAPACITOR_SERVER_URL || 'http://10.0.2.2:4000' };
function execute(task) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [cli, task, 'android'], { stdio: 'inherit', env });
        child.on('error', reject);
        child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Capacitor ${task} exited with ${code}`)));
    });
}
await execute('sync');
if (command === 'run') await execute('run');
