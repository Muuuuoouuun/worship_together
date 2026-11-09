/*
 * tests/nativeAuth.test.ts 의 동시 교환 검사용 워커. 서버 프로세스 하나처럼 같은 SQLite 파일을 따로 열고,
 * 모든 워커가 준비될 때까지 기다렸다가 동시에 같은 코드를 교환합니다.
 */
import { parentPort, workerData } from 'node:worker_threads';
import { TeamRepository } from '../../lib/server/teamRepository';
import { AppLoginCodes } from '../../lib/server/appLoginCodes';
import { challengeFor, hashLoginCode } from '../../lib/nativeAuth';

const { file, code, verifier, barrier, count } = workerData as { file: string; code: string; verifier: string; barrier: SharedArrayBuffer; count: number };
const repository = new TeamRepository(file);
const codes = new AppLoginCodes(repository.database);
async function main() {
    const [codeHash, challenge] = await Promise.all([hashLoginCode(code), challengeFor(verifier)]);
    const gate = new Int32Array(barrier);
    // 마지막으로 도착한 워커가 모두를 깨웁니다.
    if (Atomics.add(gate, 0, 1) + 1 === count) Atomics.notify(gate, 0);
    else while (Atomics.load(gate, 0) < count) Atomics.wait(gate, 0, Atomics.load(gate, 0), 1000);
    try {
        parentPort!.postMessage(codes.consume(codeHash, challenge));
    } catch (error) {
        parentPort!.postMessage({ ok: false, reason: `error:${(error as Error).message}` });
    } finally {
        repository.close();
    }
}
void main();
