import { namespaceWrapper, taskNodeAdministered } from '@_koii/namespace-wrapper';
import os from 'os';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { exec } from 'child_process';

const getPlatformExt = (): string | null  => {
  const platform = os.platform();
  const arch = os.arch();

  if (platform === 'darwin') {
    if (arch === 'x64') {
      return 'darwin-amd64';
    } else if (arch === 'arm64') {
      return 'darwin-arm64';
    }
  } else if (platform === 'linux') {
    return 'linux-amd64';
  } else if (platform === 'win32') {
    return 'windows-amd64';
  }

  return null;
}

const downloadFile = async (url: string, dest: string): Promise<void> => {
  const response = await axios.get(url, {responseType: 'stream'});
  const writer = fs.createWriteStream(dest);
  return new Promise((resolve, reject) => {
    // Type assertion to handle the 'any' type
    const stream = response.data as NodeJS.ReadableStream;
    stream.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
};

const setExecutablePermission = (filePath: string): void => {
  fs.chmodSync(filePath, '755'); // Add execute permission for owner
};

const downloadFileIfNeeded = async (url: string, destination: string, currentPlatform: string, ext: string): Promise<string> => {
  const fileName = `${currentPlatform}_ipfs${ext}`; // Adjust the version and filename accordingly

  let filePath;
  if (taskNodeAdministered) {
    filePath = path.join(destination, fileName);
  } else {
    filePath = `${destination}${fileName}`;
  }
  if (fs.existsSync(filePath)) {
    console.log('File already exists, skipping download.');
    return filePath;
  }

  console.log("Downloading file...");
  await downloadFile(url, filePath);
  setExecutablePermission(filePath); // Set executable permissions after download
  console.log("File downloaded successfully");
  return filePath;
};

const startIPFSDaemon = async (filePath: string): Promise<unknown> => {
  const command = `"${filePath}" daemon --init --migrate=true`;
  console.log('Running ', command);

  // Start the IPFS daemon
  const startDaemon = (): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      exec(command, (error) => {
        if (error) {
          console.error(error);
          reject(error);
        } else {
          resolve(true);
        }
      });
    });
  };

  // Cleanup function to stop the IPFS daemon
  const stopDaemon = (): Promise<unknown> => {
    const command = `"${filePath}" shutdown`;
    console.log(`Running ${command}`);
    return new Promise((resolve, reject) => {
      exec(command, (error) => {
        if (error) {
          console.error(error);
          reject(error);
        } else {
          resolve(true);
        }
      });
    });
  };

  // Listen for process exit event
  process.on('exit', () => {
    console.log('Exiting...');
    stopDaemon()
      .then(() => {
        console.log('IPFS daemon stopped');
      })
      .catch((error) => {
        console.error('Failed to stop IPFS daemon:', error);
      });
  });

  // Listen for SIGINT (Ctrl+C) event
  process.on('SIGINT', () => {
    console.log('SIGINT received. Exiting...');
    stopDaemon()
      .then(() => {
        console.log('IPFS daemon stopped');
      })
      .catch((error) => {
        console.error('Failed to stop IPFS daemon:', error);
      });
    process.exit(1); // Exit with error code 1
  });
  // Listen for SIGINT (Ctrl+C) event
  process.on('SIGTERM', () => {
    console.log('SIGINT received. Exiting...');
    stopDaemon()
      .then(() => {
        console.log('IPFS daemon stopped');
      })
      .catch((error) => {
        console.error('Failed to stop IPFS daemon:', error);
      });
    process.exit(1); // Exit with error code 1
  });

  // Start the daemon and return the promise
  return startDaemon();
};


async function downloadAndStartKuboWrapper(): Promise<void> {
  const currentPlatform = getPlatformExt();

  if (!currentPlatform) {
    console.error("Unsupported platform");
    return;
  }

  let ext = '';
  if (currentPlatform.includes('windows')) ext = '.exe';
  const url = `https://github.com/SyedGhazanferAnwar/kubo-binaries/releases/download/v0.24.0/${currentPlatform}_ipfs${ext}`;

  const downloadPath = await namespaceWrapper.getBasePath();
  console.log("STARTING DOWNLOAD KUBO:", url);
  const filePath = await downloadFileIfNeeded(url, downloadPath, currentPlatform, ext);
  await startIPFSDaemon(filePath);
  console.log("IPFS daemon running!");
}

export async function setup(): Promise<void> {
  // define any steps that must be executed before the task starts
  console.log("CUSTOM SETUP");
  await downloadAndStartKuboWrapper();
}
