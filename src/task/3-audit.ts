import { namespaceWrapper } from "@_koii/namespace-wrapper";
import axios from 'axios';
import { baseIpfsGatewayUrl } from './ipfsEndpoints';

interface Submission {
  cids: string[];
  proofs: {cid: string, mainAccountPubkey: string, signature: string}[];
}

async function fetchFileFromIPFS(cid: string): Promise<Buffer | null> {
  try {
    const response = await axios.get(`${baseIpfsGatewayUrl}/ipfs/${cid}`, {
      responseType: 'arraybuffer',
    });
    return Buffer.from(response.data);
  } catch (error) {
    console.error(`Error fetching file from IPFS for CID: ${cid}`, error);
    return null;
  }
}

export async function audit(
  submission: string,
  roundNumber: number,
  submitterKey: string,
): Promise<boolean | void> {
  /**
   * Audit a submission
   * This function should return true if the submission is correct, false otherwise
   */
  console.log(`AUDIT SUBMISSION FOR ROUND ${roundNumber} from ${submitterKey}`);
  console.log(submission);
  let vote = false;
  const parsedSubmission = JSON.parse(submission) as Submission;

  try {
    // TODO: Check the submitter has the right to store
    for (const proof of parsedSubmission.proofs) {
      const {cid, mainAccountPubkey, signature} = proof;
      console.log('CID:', cid);
      console.log('MAIN ACCOUNT PUB KEY', mainAccountPubkey);
      console.log('SIGNATURE', signature);

      // 1. Fetch the file from IPFS
      const fileBuffer = await fetchFileFromIPFS(cid);
      if (!fileBuffer) {
        console.error('FILE BUFFER IS NULL');
        return false;
      }
      console.log('FILE BUFFER', fileBuffer);

      const taskState = await namespaceWrapper.getTaskState({});
      if (!taskState) {
        console.error('TASK STATE IS NULL');
        return false;
      }
      console.log('TASK STATE', taskState);

      // 2. Check that the proofs are valid (signature, etc)
      const { data, error }: { data?: string | undefined, error?: string | undefined } = await namespaceWrapper.verifySignature(signature, mainAccountPubkey);
      if (!data) {
        console.error('SIGNATURE IS NOT VALID');
        console.error('ERROR', error);
        return false;
      }
      const parsedData = JSON.parse(data) as {cid: string};
      console.log('PARSED DATA', parsedData);
      vote = parsedData.cid === cid;
      // 3. Query the node for CID
      if (taskState.ip_address_list && taskState.ip_address_list[submitterKey]) {
        const nodeIpAddress = taskState.ip_address_list[submitterKey];
        try {
          const nodeResponse = await axios.get(`${nodeIpAddress}/ipfs/${cid}`, {
            responseType: 'arraybuffer',
            timeout: 5000 // 5 seconds timeout
          });
          console.log('NODE RESPONSE', nodeResponse);

          // a) Check if they sent the file
          if (nodeResponse.status === 200) {
            const nodeFileBuffer = Buffer.from(nodeResponse.data);

            // b) Check if the file sent matches the CID
            if (nodeFileBuffer.equals(fileBuffer)) {
              console.log(`File from node matches IPFS for CID: ${cid}`);
              vote = true;
            } else {
              console.log(`File from node does not match IPFS for CID: ${cid}`);
              vote = false;
            }
          } else {
            console.log(`Node did not send the file for CID: ${cid}`);
            vote = false;
          }
        } catch (error) {
          console.error(`Error querying node for CID: ${cid}`, error);
          vote = false;
        }
      } else {
        console.log(`No IP address found for submitterKey: ${submitterKey}`);
        vote = false;
      }
    }
  } catch (error) {
    console.error('Error auditing submission', error);
    vote = false;
  }

  return vote;
}
