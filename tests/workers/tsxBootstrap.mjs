// 워커 스레드는 tsx 로더를 물려받지 않습니다. 로더를 먼저 등록한 뒤 TypeScript 워커(workerData.entry)를 불러옵니다.
import { register } from 'tsx/esm/api';
import { workerData } from 'node:worker_threads';

register();
await import(workerData.entry);
