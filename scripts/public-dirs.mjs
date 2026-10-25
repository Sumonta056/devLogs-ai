import { REPORTS } from './site-config.mjs';
import { publicDirs } from './lib.mjs';

console.log(publicDirs(REPORTS).join(' '));
