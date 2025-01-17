import { namespaceWrapper, app } from "@_koii/namespace-wrapper";
import { getPinnedCIDs, addIPFSCID, getIPFSCID } from "./ipfsEndpoints";
import multer from 'multer';

/**
 * 
 * Define all your custom routes here
 * 
 */

//Example route 
// eslint-disable-next-line @typescript-eslint/require-await
export async function routes() : Promise<void> {
  app.get("/value", async (_req, res) => {
    const value = await namespaceWrapper.storeGet("value");
    console.log("value", value);
    res.status(200).json({ value: value });
  });

  const storage: multer.StorageEngine = multer.memoryStorage();
  const upload = multer({ 
    storage: storage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  });

  app.get('/ipfs/get-pinned-cids', getPinnedCIDs);
  app.post('/ipfs/add', upload.array('files'), addIPFSCID);
  app.get('/ipfs/:cid/:filename?', getIPFSCID);
}
