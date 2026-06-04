import { createSmartAccountClient } from 'permissionless';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { createPublicClient, http } from 'viem';
import { bscTestnet, bsc } from 'viem/chains';
import { BSC_CHAIN_ID, PIMLICO_BUNDLER_URL, PIMLICO_PAYMASTER_URL, BSC_RPC_URL } from './constants';
import type { LocalAccount } from 'viem';

export async function getPimlicoSmartAccount(signer: LocalAccount) {
  if (!PIMLICO_BUNDLER_URL || !PIMLICO_PAYMASTER_URL) {
    throw new Error('Pimlico URLs not configured');
  }

  const chain = BSC_CHAIN_ID === 56 ? bsc : bscTestnet;

  const publicClient = createPublicClient({
    chain,
    transport: http(BSC_RPC_URL),
  });

  const pimlicoClient = createPimlicoClient({
    transport: http(PIMLICO_PAYMASTER_URL),
    entryPoint: {
      address: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789', // v0.6
      version: '0.6',
    },
  });

  const simpleSmartAccount = await toSimpleSmartAccount({
    client: publicClient,
    owner: signer,
    factoryAddress: '0x9406Cc6185a346906296840746125a0E44976454', // SimpleAccountFactory
    entryPoint: {
      address: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789', // v0.6
      version: '0.6',
    },
  });

  const smartAccountClient = createSmartAccountClient({
    account: simpleSmartAccount,
    chain,
    bundlerTransport: http(PIMLICO_BUNDLER_URL),
    paymaster: pimlicoClient,
  });

  return {
    smartAccountAddress: simpleSmartAccount.address,
    smartAccountClient,
  };
}
