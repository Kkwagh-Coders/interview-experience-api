import { spawn } from 'child_process';
import path from 'path';

const getBackupFileName = (name: string, extension: string) => {
  const date = new Date();
  return `${name}_${date.getFullYear()}-${
    date.getMonth() + 1
  }-${date.getDate()}_${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}.${extension}`;
};

export const backupDatabase = () => {
  // setting up variables
  console.log('Setting up variables....');

  const DB_NAME = process.env['DB_NAME'];
  if (!DB_NAME) {
    console.log('Please Provide DB Name');
    return;
  }

  const BACKUP_PATH = path.join(
    __dirname,
    'backup',
    getBackupFileName(DB_NAME, 'gzip'),
  );

  const DB_URI = process.env['MONGODB_BACKUP_URL'];
  const args = [`--uri=${DB_URI}`, `--out=${BACKUP_PATH}`, `--gzip`];

  // creating child process
  console.log('Creating child process....');
  const child = spawn('mongodump', args);
  console.log('Child process created....');

  // setting up handlers
  console.log('Setting up handlers....');
  // outputs console data of child process
  child.stdout.on('data', (data: Buffer) => {
    console.log('output on terminal : \n', data);
  });

  // outputs console error on child process
  child.stderr.on('data', (data: Buffer) => {
    console.log('output error on terminal: \n', data.toString());
  });

  // outputs the error of node.js file
  child.on('error', (error) => {
    console.log('error: \n', error);
  });

  child.on('exit', (code, signal) => {
    if (code) console.log(' Process exited with code :', code);
    else if (signal) console.log(' Process killed with :', signal);
    else console.log('Backup successful');
  });

  console.log('End....');
};
