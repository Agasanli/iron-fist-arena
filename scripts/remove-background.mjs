import { removeBackground } from '@imgly/background-removal-node';
import fs from 'fs';
import path from 'path';
const [,, inp, out] = process.argv;
const buf = fs.readFileSync(inp);
const blob = new Blob([buf], { type: 'image/png' });
const res = await removeBackground(blob, { output: { format: 'image/png' }, model: 'medium' });
fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
console.log('ok', out);
