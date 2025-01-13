import { namespaceWrapper } from "@_koii/namespace-wrapper";
import axios from "axios";
import { baseIpfsApiUrl, PinnedResponse } from "./ipfsEndpoints";

export async function task(roundNumber: number): Promise<void> {
  // Run your task and store the proofs to be submitted for auditing
  // The submission of the proofs is done in the submission function
  try {
    console.log(`EXECUTE TASK FOR ROUND ${roundNumber}`);
    const ipfsResponse = await axios.post<PinnedResponse>(`${baseIpfsApiUrl}/api/v0/pin/ls`);
    const data = ipfsResponse.data;
    const cids = Object.keys(data.Keys);
    
    const proofs = await Promise.all(cids.map(async (cid) => {
      const mainAccountPubkey = await namespaceWrapper.getMainAccountPubkey();
      const signature = await namespaceWrapper.payloadSigning({cid});
      return {cid, mainAccountPubkey, signature};
    }));

    const submission = {
      cids,
      proofs
    }

    // you can optionally return this value to be used in debugging
    await namespaceWrapper.storeSet("value", JSON.stringify(submission));
  } catch (error) {
    console.error("EXECUTE TASK ERROR:", error);
  }
}
