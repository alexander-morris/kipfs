import axios, { AxiosError } from 'axios';
import crypto from 'crypto';
import FormData from 'form-data';
import { Connection, PublicKey } from '@_koii/web3.js';
import type { Request, Response } from 'express';

interface IpfsResponse {
  Name: string;
  Hash: string;
}

export const baseIpfsApiUrl = 'http://127.0.0.1:5001';
export const baseIpfsGatewayUrl = 'http://127.0.0.1:8080';

const connection = new Connection('https://mainnet.koii.network');

export const getIPFSCID = async (req: Request, res: Response): Promise<void> => {
  try {
    const { cid, filename } = req.params;
    const response = await axios.get<NodeJS.ReadableStream>(`${baseIpfsGatewayUrl}/ipfs/${cid}/${filename || ''}`, {
      responseType: 'stream',
      timeout: 180000,
    });

    const contentType = response.headers['content-type'] as string | undefined;
    if (contentType) {
      res.set('Content-Type', contentType);
    }

    // Pipe the response stream directly to res
    response.data.pipe(res);

    // Pinning the data that you served
    void axios
      .post(`${baseIpfsApiUrl}/api/v0/pin/add?arg=${cid}`)
      .then((pinResponse) => {
        console.log('Pin added successfully:', pinResponse.data);
      })
      .catch((error: Error) => {
        console.error('Error adding pin:', error);
      });
  } catch (error) {
    if (error instanceof Error) {
      const axiosError = error as AxiosError;
      if (error.message.includes('ECONNABORTED')) {
        res.status(504).send('Request Timed Out');
      } else if (axiosError.response?.status === 404) {
        res.status(404).send('Not found');
      } else {
        res.status(422).send(error.message);
      }
      
      if (axiosError.response) {
        console.error('Server responded with status:', axiosError.response.status);
        console.error('Response data:', axiosError.response.data);
      } else {
        console.error('Error:', error.message);
      }
    }
  }
};

export const addIPFSCID = async (req: Request & { files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] } }, res: Response): Promise<void> => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      res.status(400).send('No files were uploaded');
      return;
    }

    const formData = new FormData();

    const fileArray = Array.isArray(files) ? files : Object.values(files).flat();
    fileArray.forEach((file, index) => {
      formData.append(`${file.originalname}-${index}`, file.buffer, {
        filename: file.originalname,
        filepath: file.originalname,
        contentType: file.mimetype,
      });
    });

    const ipfsResponse = await axios.post<string>(
      `${baseIpfsApiUrl}/api/v0/add?wrap-with-directory=true&cid-version=1`,
      formData
    );

    const parsedResp = ipfsResponse.data
      .split('\n')
      .filter((e: string) => e !== '')
      .map((e: string) => JSON.parse(e) as IpfsResponse);

    const folderHash = parsedResp.find((e) => e.Name === '');
    console.log('folderHash?.Hash', folderHash);
    res.send({ status: 200, cid: folderHash?.Hash });
  } catch (error) {
    if (error instanceof Error) {
      const axiosError = error as AxiosError;
      if (error.message.includes('ECONNABORTED')) {
        res.status(504).send('Request Timed Out');
      } else {
        res.status(500).send('Internal Server Error');
      }

      if (axiosError.response) {
        console.error('Server responded with status:', axiosError.response.status);
        console.error('Response data:', axiosError.response.data);
      } else {
        console.error('Error:', error.message);
      }
    }
  }
};

export interface PinnedResponse {
  Keys: Record<string, unknown>;
}

export const getPinnedCIDs = async (_req: Request, res: Response): Promise<void> => {
  try {
    const ipfsResponse = await axios.post<PinnedResponse>(`${baseIpfsApiUrl}/api/v0/pin/ls`);
    res.send({ status: 200, pinnedCIDs: ipfsResponse.data });
  } catch (error) {
    if (error instanceof Error) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        console.error('Server responded with status:', axiosError.response.status);
        console.error('Response data:', axiosError.response.data);
      } else {
        console.error('Error:', error.message);
      }
      res.status(500).send('Internal Server Error');
    }
  }
};

export function hashFileData(fileData: Buffer, algorithm = 'sha256'): string {
  const hash = crypto.createHash(algorithm);
  hash.update(fileData);
  return hash.digest('hex');
}

export async function checkStakingWalletValidity(stakingWalletPubkey: string): Promise<boolean> {
  try {
    const account = await connection.getAccountInfo(new PublicKey(stakingWalletPubkey));
    if (!account) return false;
    return account.owner.toBase58() === 'Koiitask22222222222222222222222222222222222';
  } catch (error) {
    console.error(error);
    return true;
  }
}
