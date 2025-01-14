import "jest-extended";
import Web3 from "web3";
import { v4 as uuidV4 } from "uuid";

import { LogLevelDesc } from "@hyperledger/cactus-common";

import { PluginKeychainMemory } from "@hyperledger/cactus-plugin-keychain-memory";

import HelloWorldContractJson from "../../../../solidity/hello-world-contract/HelloWorld.json";

import {
  EthContractInvocationType,
  PluginLedgerConnectorEthereum,
  Web3SigningCredentialCactusKeychainRef,
  Web3SigningCredentialType,
} from "../../../../../main/typescript/public-api";

import {
  QuorumTestLedger,
  IQuorumGenesisOptions,
  IAccount,
} from "@hyperledger/cactus-test-tooling";
import { PluginRegistry } from "@hyperledger/cactus-core";

const logLevel: LogLevelDesc = "INFO";
const contractName = "HelloWorld";
const testCase = "Ethereum Ledger Connector Plugin";

describe(testCase, () => {
  afterAll(async () => {
    await ledger.stop();
    await ledger.destroy();
  });

  const containerImageVersion = "2021-05-03-quorum-v21.4.1";
  const ledgerOptions = { containerImageVersion };
  const ledger = new QuorumTestLedger(ledgerOptions);

  test(testCase, async () => {
    await ledger.start();
    const rpcApiHttpHost = await ledger.getRpcApiHttpHost();
    const ethereumGenesisOptions: IQuorumGenesisOptions = await ledger.getGenesisJsObject();
    expect(ethereumGenesisOptions).toBeTruthy();
    expect(ethereumGenesisOptions.alloc).toBeTruthy();

    const highNetWorthAccounts: string[] = Object.keys(
      ethereumGenesisOptions.alloc,
    ).filter((address: string) => {
      const anAccount: IAccount = ethereumGenesisOptions.alloc[address];
      const theBalance = parseInt(anAccount.balance, 10);
      return theBalance > 10e7;
    });
    const [firstHighNetWorthAccount] = highNetWorthAccounts;

    const web3 = new Web3(rpcApiHttpHost);
    const testEthAccount = web3.eth.accounts.create(uuidV4());

    const keychainEntryKey = uuidV4();
    const keychainEntryValue = testEthAccount.privateKey;
    const keychainPlugin = new PluginKeychainMemory({
      instanceId: uuidV4(),
      keychainId: uuidV4(),
      // pre-provision keychain with mock backend holding the private key of the
      // test account that we'll reference while sending requests with the
      // signing credential pointing to this keychain entry.
      backend: new Map([[keychainEntryKey, keychainEntryValue]]),
      logLevel,
    });
    keychainPlugin.set(
      HelloWorldContractJson.contractName,
      JSON.stringify(HelloWorldContractJson),
    );
    // Instantiate connector with the keychain plugin that already has the
    // private key we want to use for one of our tests
    const connector: PluginLedgerConnectorEthereum = new PluginLedgerConnectorEthereum(
      {
        instanceId: uuidV4(),
        rpcApiHttpHost,
        logLevel,
        pluginRegistry: new PluginRegistry({ plugins: [keychainPlugin] }),
      },
    );

    await connector.transact({
      web3SigningCredential: {
        ethAccount: firstHighNetWorthAccount,
        secret: "",
        type: Web3SigningCredentialType.GethKeychainPassword,
      },
      transactionConfig: {
        from: firstHighNetWorthAccount,
        to: testEthAccount.address,
        value: 10e9,
      },
    });

    const balance = await web3.eth.getBalance(testEthAccount.address);
    expect(balance).toBeTruthy();
    expect(parseInt(balance, 10)).toEqual(10e9);
    let contractAddress: string;

    {
      const deployOut = await connector.deployContract({
        keychainId: keychainPlugin.getKeychainId(),
        contractName: HelloWorldContractJson.contractName,
        web3SigningCredential: {
          ethAccount: firstHighNetWorthAccount,
          secret: "",
          type: Web3SigningCredentialType.GethKeychainPassword,
        },
        gas: 1000000,
      });
      expect(deployOut).toBeTruthy();
      expect(deployOut.transactionReceipt).toBeTruthy();
      expect(deployOut.transactionReceipt.contractAddress).toBeTruthy();

      contractAddress = deployOut.transactionReceipt.contractAddress as string;
      expect(typeof contractAddress === "string").toBeTrue();

      const { callOutput: helloMsg } = await connector.getContractInfoKeychain({
        contractName,
        keychainId: keychainPlugin.getKeychainId(),
        invocationType: EthContractInvocationType.Call,
        methodName: "sayHello",
        params: [],
        web3SigningCredential: {
          ethAccount: firstHighNetWorthAccount,
          secret: "",
          type: Web3SigningCredentialType.GethKeychainPassword,
        },
      });
      expect(helloMsg).toBeTruthy();
      expect(typeof helloMsg === "string").toBeTrue();
    }

    {
      const newName = `DrCactus${uuidV4()}`;
      const setNameOut = await connector.getContractInfoKeychain({
        contractName,
        keychainId: keychainPlugin.getKeychainId(),
        invocationType: EthContractInvocationType.Send,
        methodName: "setName",
        params: [newName],
        web3SigningCredential: {
          ethAccount: firstHighNetWorthAccount,
          secret: "",
          type: Web3SigningCredentialType.GethKeychainPassword,
        },
        nonce: 2,
      });
      expect(setNameOut).toBeTruthy();

      try {
        const setNameOutInvalid = await connector.getContractInfoKeychain({
          contractName,
          keychainId: keychainPlugin.getKeychainId(),
          invocationType: EthContractInvocationType.Send,
          methodName: "setName",
          params: [newName],
          gas: 1000000,
          web3SigningCredential: {
            ethAccount: firstHighNetWorthAccount,
            secret: "",
            type: Web3SigningCredentialType.GethKeychainPassword,
          },
          nonce: 2,
        });
        expect(setNameOutInvalid.transactionReceipt).toBeFalsy();
      } catch (error) {
        expect(error.message).toMatch(/nonce too low/);
      }

      const getNameOut = await connector.getContractInfoKeychain({
        contractName,
        keychainId: keychainPlugin.getKeychainId(),
        invocationType: EthContractInvocationType.Send,
        methodName: "getName",
        params: [],
        web3SigningCredential: {
          ethAccount: firstHighNetWorthAccount,
          secret: "",
          type: Web3SigningCredentialType.GethKeychainPassword,
        },
      });
      expect(getNameOut.success).toBeTruthy();

      const {
        callOutput: getNameOut2,
      } = await connector.getContractInfoKeychain({
        contractName,
        keychainId: keychainPlugin.getKeychainId(),
        invocationType: EthContractInvocationType.Call,
        methodName: "getName",
        params: [],
        web3SigningCredential: {
          ethAccount: firstHighNetWorthAccount,
          secret: "",
          type: Web3SigningCredentialType.GethKeychainPassword,
        },
      });
      expect(getNameOut2).toEqual(newName);
    }

    {
      const testEthAccount2 = web3.eth.accounts.create(uuidV4());
      const { rawTransaction } = await web3.eth.accounts.signTransaction(
        {
          from: testEthAccount.address,
          to: testEthAccount2.address,
          value: 10e6,
          gas: 1000000,
        },
        testEthAccount.privateKey,
      );

      await connector.transact({
        web3SigningCredential: {
          type: Web3SigningCredentialType.None,
        },
        transactionConfig: {
          rawTransaction,
        },
      });

      const balance2 = await web3.eth.getBalance(testEthAccount2.address);
      expect(balance2).toBeTruthy();
      expect(parseInt(balance2, 10)).toEqual(10e6);
    }

    {
      const newName = `DrCactus${uuidV4()}`;
      const setNameOut = await connector.getContractInfoKeychain({
        contractName,
        keychainId: keychainPlugin.getKeychainId(),
        invocationType: EthContractInvocationType.Send,
        methodName: "setName",
        params: [newName],
        web3SigningCredential: {
          ethAccount: testEthAccount.address,
          secret: testEthAccount.privateKey,
          type: Web3SigningCredentialType.PrivateKeyHex,
        },
        nonce: 1,
      });
      expect(setNameOut).toBeTruthy();

      try {
        const setNameOutInvalid = await connector.getContractInfoKeychain({
          contractName,
          keychainId: keychainPlugin.getKeychainId(),
          invocationType: EthContractInvocationType.Send,
          methodName: "setName",
          params: [newName],
          gas: 1000000,
          web3SigningCredential: {
            ethAccount: testEthAccount.address,
            secret: testEthAccount.privateKey,
            type: Web3SigningCredentialType.PrivateKeyHex,
          },
          nonce: 1,
        });
        expect(setNameOutInvalid.transactionReceipt).toBeFalsy();
      } catch (error) {
        expect(error.message).toMatch(/nonce too low/);
      }
      const {
        callOutput: getNameOut,
      } = await connector.getContractInfoKeychain({
        contractName,
        keychainId: keychainPlugin.getKeychainId(),
        invocationType: EthContractInvocationType.Call,
        methodName: "getName",
        params: [],
        gas: 1000000,
        web3SigningCredential: {
          ethAccount: testEthAccount.address,
          secret: testEthAccount.privateKey,
          type: Web3SigningCredentialType.PrivateKeyHex,
        },
      });
      expect(getNameOut).toEqual(newName);

      const getNameOut2 = await connector.getContractInfoKeychain({
        contractName,
        keychainId: keychainPlugin.getKeychainId(),
        invocationType: EthContractInvocationType.Send,
        methodName: "getName",
        params: [],
        gas: 1000000,
        web3SigningCredential: {
          ethAccount: testEthAccount.address,
          secret: testEthAccount.privateKey,
          type: Web3SigningCredentialType.PrivateKeyHex,
        },
      });
      expect(getNameOut2).toBeTruthy();
    }

    {
      const newName = `DrCactus${uuidV4()}`;

      const web3SigningCredential: Web3SigningCredentialCactusKeychainRef = {
        ethAccount: testEthAccount.address,
        keychainEntryKey,
        keychainId: keychainPlugin.getKeychainId(),
        type: Web3SigningCredentialType.CactusKeychainRef,
      };

      const setNameOut = await connector.getContractInfoKeychain({
        contractName,
        keychainId: keychainPlugin.getKeychainId(),
        invocationType: EthContractInvocationType.Send,
        methodName: "setName",
        params: [newName],
        gas: 1000000,
        web3SigningCredential,
        nonce: 3,
      });
      expect(setNameOut).toBeTruthy();

      try {
        const setNameOutInvalid = await connector.getContractInfoKeychain({
          contractName,
          keychainId: keychainPlugin.getKeychainId(),
          invocationType: EthContractInvocationType.Send,
          methodName: "setName",
          params: [newName],
          gas: 1000000,
          web3SigningCredential: {
            ethAccount: firstHighNetWorthAccount,
            secret: "",
            type: Web3SigningCredentialType.GethKeychainPassword,
          },
          nonce: 3,
        });
        expect(setNameOutInvalid.transactionReceipt).toBeFalsy();
      } catch (error) {
        expect(error.message).toMatch(/nonce too low/);
      }
      const {
        callOutput: getNameOut,
      } = await connector.getContractInfoKeychain({
        contractName,
        keychainId: keychainPlugin.getKeychainId(),
        invocationType: EthContractInvocationType.Call,
        methodName: "getName",
        params: [],
        gas: 1000000,
        web3SigningCredential,
      });
      expect(getNameOut).toEqual(newName);

      const getNameOut2 = await connector.getContractInfoKeychain({
        contractName,
        keychainId: keychainPlugin.getKeychainId(),
        invocationType: EthContractInvocationType.Send,
        methodName: "getName",
        params: [],
        gas: 1000000,
        web3SigningCredential,
      });
      expect(getNameOut2).toBeTruthy();
    }
  });
});
