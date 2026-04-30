export interface ProxyConfig {
  port: number;
  apiKey: string;
}

export interface AuthContext {
  sessionToken: string;
  cookieName: string;
  loginUrl: string;
}

export interface ZapAlert {
  alert: string;
  riskcode: string;
  confidence: string;
  url: string;
  description: string;
  solution: string;
  evidence: string;
  reference?: string;
  cweid?: string;
  wascid?: string;
  pluginId: string;
}

export interface PassiveScanStatus {
  recordsToScan: number;
}
