import * as path from 'path';
import * as fs from 'fs-extra';

export function writeFileWorker(data: any, callback: any) {
  fs.ensureDirSync(path.dirname(data.file));

  if (fs.existsSync(data.file)) {
    // remove read-only and other attributes and delete file
    fs.chmodSync(data.file, '0777');
    fs.unlinkSync(data.file);
  }

  const content = Buffer.from(data.content);
  fs.writeFileSync(data.file, content);

  callback();
}
