import { AddressInfo } from "net";
import { v4 as uuidv4 } from "uuid";
import { Server } from "http";
import exitHook, { IAsyncExitHookDoneCallback } from "async-exit-hook";
import { PluginRegistry } from "@hyperledger/cactus-core";
import {
  LogLevelDesc,
  Logger,
  LoggerProvider,
  Servers,
} from "@hyperledger/cactus-common";
import {
  ApiServer,
  AuthorizationProtocol,
  ConfigService,
  ICactusApiServerOptions,
} from "@hyperledger/cactus-cmd-api-server";
import {
  Configuration,
  DefaultApi as OdapApi,
} from "@hyperledger/cactus-plugin-odap-hermes/src/main/typescript/index";
import { PluginKeychainMemory } from "@hyperledger/cactus-plugin-keychain-memory";
import { CbdcBridgingAppDummyInfrastructure } from "./infrastructure/cbdc-bridging-app-dummy-infrastructure";
import { DefaultApi as FabricApi } from "@hyperledger/cactus-plugin-ledger-connector-fabric";
import { DefaultApi as BesuApi } from "@hyperledger/cactus-plugin-ledger-connector-besu";
import { IOdapPluginKeyPair } from "@hyperledger/cactus-plugin-odap-hermes/src/main/typescript/gateway/plugin-odap-gateway";
import { DefaultApi as IpfsApi } from "@hyperledger/cactus-plugin-object-store-ipfs";
import { FabricOdapGateway } from "./odap-extension/fabric-odap-gateway";
import { BesuOdapGateway } from "./odap-extension/besu-odap-gateway";
import CryptoMaterial from "../../crypto-material/crypto-material.json";

export interface ICbdcBridgingApp {
  apiHost: string;
  apiServer1Port: number;
  apiServer2Port: number;
  clientGatewayKeyPair: IOdapPluginKeyPair;
  serverGatewayKeyPair: IOdapPluginKeyPair;
  logLevel?: LogLevelDesc;
  apiServerOptions?: ICactusApiServerOptions;
  disableSignalHandlers?: true;
}

export type ShutdownHook = () => Promise<void>;
export class CbdcBridgingApp {
  private readonly log: Logger;
  private readonly shutdownHooks: ShutdownHook[];
  readonly infrastructure: CbdcBridgingAppDummyInfrastructure;

  public constructor(public readonly options: ICbdcBridgingApp) {
    const fnTag = "CbdcBridgingApp#constructor()";

    if (!options) {
      throw new Error(`${fnTag} options parameter is falsy`);
    }
    const { logLevel } = options;

    const level = logLevel || "INFO";
    const label = "cbdc-bridging-app";
    this.log = LoggerProvider.getOrCreate({ level, label });

    this.shutdownHooks = [];

    this.infrastructure = new CbdcBridgingAppDummyInfrastructure({
      logLevel: level,
    });
  }

  public async start(): Promise<IStartInfo> {
    this.log.debug(`Starting CBDC Bridging App...`);

    if (!this.options.disableSignalHandlers) {
      exitHook((callback: IAsyncExitHookDoneCallback) => {
        this.stop().then(callback);
      });
      this.log.debug(`Registered signal handlers for graceful auto-shutdown`);
    }

    await this.infrastructure.start();
    this.onShutdown(() => this.infrastructure.stop());

    const fabricPlugin = await this.infrastructure.createFabricLedgerConnector();
    const besuPlugin = await this.infrastructure.createBesuLedgerConnector();
    const clientIpfsPlugin = await this.infrastructure.createIPFSConnector();
    const serverIpfsPlugin = await this.infrastructure.createIPFSConnector();

    // Reserve the ports where the API Servers will run
    const httpApiA = await Servers.startOnPort(
      this.options.apiServer1Port,
      this.options.apiHost,
    );
    const httpApiB = await Servers.startOnPort(
      this.options.apiServer2Port,
      this.options.apiHost,
    );

    const addressInfoA = httpApiA.address() as AddressInfo;
    const nodeApiHostA = `http://${this.options.apiHost}:${addressInfoA.port}`;

    const addressInfoB = httpApiB.address() as AddressInfo;
    const nodeApiHostB = `http://${this.options.apiHost}:${addressInfoB.port}`;

    const fabricOdapGateway = await this.infrastructure.createClientGateway(
      nodeApiHostA,
      this.options.clientGatewayKeyPair,
      `http://${this.options.apiHost}:${addressInfoA.port}`,
    );

    const besuOdapGateway = await this.infrastructure.createServerGateway(
      nodeApiHostB,
      this.options.serverGatewayKeyPair,
      `http://${this.options.apiHost}:${addressInfoB.port}`,
    );

    const clientPluginRegistry = new PluginRegistry({
      plugins: [
        new PluginKeychainMemory({
          keychainId: CryptoMaterial.keychains.keychain1.id,
          instanceId: uuidv4(),
          logLevel: "INFO",
        }),
      ],
    });
    const serverPluginRegistry = new PluginRegistry({
      plugins: [
        new PluginKeychainMemory({
          keychainId: CryptoMaterial.keychains.keychain2.id,
          instanceId: uuidv4(),
          logLevel: "INFO",
        }),
      ],
    });

    clientPluginRegistry.add(fabricPlugin);
    clientPluginRegistry.add(fabricOdapGateway);
    clientPluginRegistry.add(clientIpfsPlugin);

    serverPluginRegistry.add(besuPlugin);
    serverPluginRegistry.add(serverIpfsPlugin);
    serverPluginRegistry.add(besuOdapGateway);

    const apiServer1 = await this.startNode(httpApiA, clientPluginRegistry);
    const apiServer2 = await this.startNode(httpApiB, serverPluginRegistry);

    const fabricApiClient = new FabricApi(
      new Configuration({ basePath: nodeApiHostA }),
    );

    const besuApiClient = new BesuApi(
      new Configuration({ basePath: nodeApiHostB }),
    );

    this.log.info("Deploying chaincode and smart contracts...");

    await this.infrastructure.deployFabricCbdcContract(fabricApiClient);

    await this.infrastructure.deployFabricAssetReferenceContract(
      fabricApiClient,
    );

    await this.infrastructure.deployBesuContracts(besuApiClient);

    this.log.info(`Chaincode and smart Contracts deployed.`);

    return {
      apiServer1,
      apiServer2,
      fabricGatewayApi: new OdapApi(
        new Configuration({ basePath: nodeApiHostA }),
      ),
      besuGatewayApi: new OdapApi(
        new Configuration({ basePath: nodeApiHostB }),
      ),
      ipfsApiClient: new IpfsApi(new Configuration({ basePath: nodeApiHostA })),
      fabricApiClient,
      besuApiClient,
      fabricOdapGateway,
      besuOdapGateway,
    };
  }

  public async stop(): Promise<void> {
    for (const hook of this.shutdownHooks) {
      await hook(); // FIXME add timeout here so that shutdown does not hang
    }
  }

  public onShutdown(hook: ShutdownHook): void {
    this.shutdownHooks.push(hook);
  }

  public async startNode(
    httpServerApi: Server,
    pluginRegistry: PluginRegistry,
  ): Promise<ApiServer> {
    this.log.info(`Starting API Server node...`);

    const addressInfoApi = httpServerApi.address() as AddressInfo;

    let config;
    if (this.options.apiServerOptions) {
      config = this.options.apiServerOptions;
    } else {
      const configService = new ConfigService();
      const convictConfig = await configService.getOrCreate();
      config = convictConfig.getProperties();
      config.configFile = "";
      config.apiCorsDomainCsv = `http://${process.env.API_HOST_FRONTEND}:${process.env.API_PORT_FRONTEND}`;
      config.cockpitCorsDomainCsv = `http://${process.env.API_HOST_FRONTEND}:${process.env.API_PORT_FRONTEND}`;
      config.apiPort = addressInfoApi.port;
      config.apiHost = addressInfoApi.address;
      config.grpcPort = 0;
      config.logLevel = this.options.logLevel || "INFO";
      config.authorizationProtocol = AuthorizationProtocol.NONE;
    }

    const apiServer = new ApiServer({
      config,
      httpServerApi,
      pluginRegistry,
    });

    this.onShutdown(() => apiServer.shutdown());

    await apiServer.start();

    return apiServer;
  }
}

export interface IStartInfo {
  readonly apiServer1: ApiServer;
  readonly apiServer2: ApiServer;
  readonly fabricGatewayApi: OdapApi;
  readonly besuGatewayApi: OdapApi;
  readonly ipfsApiClient: IpfsApi;
  readonly besuApiClient: BesuApi;
  readonly fabricApiClient: FabricApi;
  readonly fabricOdapGateway: FabricOdapGateway;
  readonly besuOdapGateway: BesuOdapGateway;
}
