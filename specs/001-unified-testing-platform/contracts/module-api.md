# Module API Contracts

**Branch**: `001-unified-testing-platform` | **Date**: 2026-04-28

## Module Registration Interface

Every testing module MUST implement the `TestingModule` interface.

```typescript
interface TestingModule {
  /** Unique module identifier (e.g., "functional", "performance", "security") */
  id: string;

  /** Human-readable module name */
  name: string;

  /** Phase this module handles */
  phase: "FUNCTIONAL" | "PERFORMANCE" | "SECURITY";

  /** Initialize the module with session context */
  initialize(context: ModuleContext): Promise<void>;

  /** Generate test cases for this module's phase */
  generate(session: Session, documents: ContextDocument[]): Promise<TestCase[]>;

  /** Execute the given test cases */
  execute(testCases: TestCase[], options: ExecutionOptions): Promise<ExecutionResult[]>;

  /** Clean up resources (browsers, proxies, etc.) */
  cleanup(): Promise<void>;
}
```

## Module Context

```typescript
interface ModuleContext {
  sessionId: string;
  targetUrl: string;
  config: SessionConfig;
  db: DatabaseConnection;
  logger: Logger;
  reportProgress: (update: ProgressUpdate) => void;
}
```

## Execution Options

```typescript
interface ExecutionOptions {
  parallel?: number;
  timeout?: number;
  dryRun?: boolean;
  browsers?: BrowserType[];
  filter?: string[];
  onProgress?: (update: ProgressUpdate) => void;
}
```

## Progress Update

```typescript
interface ProgressUpdate {
  testCaseId?: string;
  status: "running" | "passed" | "failed" | "errored" | "skipped";
  message?: string;
  percentage?: number;
}
```

## Module Registry

The registry discovers and manages all available modules.

```typescript
interface ModuleRegistry {
  /** Register a module */
  register(module: TestingModule): void;

  /** Get module by phase */
  getByPhase(phase: Phase): TestingModule | undefined;

  /** Get all registered modules */
  getAll(): TestingModule[];

  /** Initialize all modules */
  initializeAll(context: ModuleContext): Promise<void>;

  /** Cleanup all modules */
  cleanupAll(): Promise<void>;
}
```

## Specific Module Contracts

### Functional Module (`functional`)

```typescript
interface FunctionalModule extends TestingModule {
  /** Launch browsers and prepare for execution */
  launchBrowsers(browsers: BrowserType[]): Promise<void>;

  /** Create an isolated browser context */
  createContext(browser: BrowserType): Promise<BrowserContext>;

  /** Execute a single functional test in isolation */
  executeTest(testCase: TestCase, context: BrowserContext): Promise<ExecutionResult>;

  /** Close all browsers */
  closeBrowsers(): Promise<void>;
}

type BrowserType = "chromium" | "firefox" | "webkit";
```

### Performance Module (`performance`)

```typescript
interface PerformanceModule extends TestingModule {
  /** Convert functional test definitions into load scenario */
  convertToScenario(testCases: TestCase[], config: LoadConfig): LoadScenario;

  /** Execute load scenario */
  runLoadTest(scenario: LoadScenario): Promise<PerformanceResult>;

  /** Validate results against SLA thresholds */
  validateSLA(metrics: PerformanceMetric[], thresholds: SLAThreshold[]): SLAValidationResult;
}

interface LoadConfig {
  virtualUsers: number;
  rampUpSeconds: number;
  durationSeconds: number;
  thinkTimeMs?: number;
}

interface SLAThreshold {
  metric: "response_time_p95" | "error_rate" | "throughput_rps";
  operator: "<=" | ">=" | "==";
  value: number;
}
```

### Security Module (`security`)

```typescript
interface SecurityModule extends TestingModule {
  /** Start the security proxy (ZAP daemon) */
  startProxy(options: ProxyConfig): Promise<void>;

  /** Stop the security proxy */
  stopProxy(): Promise<void>;

  /** Run passive scan analysis */
  runPassiveScan(): Promise<SecurityFinding[]>;

  /** Run active scan against target */
  runActiveScan(target: string, authContext?: AuthContext): Promise<SecurityFinding[]>;

  /** Get proxy address for browser configuration */
  getProxyAddress(): string;
}

interface ProxyConfig {
  port: number;
  apiKey: string;
}

interface AuthContext {
  sessionToken: string;
  cookieName: string;
  loginUrl: string;
}
```

### Ingestion Module (`ingestion`)

```typescript
interface IngestionModule {
  /** Parse a document and extract test definitions */
  ingestDocument(documentPath: string): Promise<ParsedDocument>;

  /** Get supported file formats */
  getSupportedFormats(): string[];

  /** Extract test definitions from parsed content */
  extractTests(parsed: ParsedDocument): Promise<TestCaseDefinition[]>;
}

interface ParsedDocument {
  filename: string;
  format: string;
  text: string;
  sections: DocumentSection[];
}

interface DocumentSection {
  title: string;
  content: string;
  type: "test_case" | "behavior" | "requirement" | "other";
}
```

## Error Handling Contract

All modules MUST throw structured errors:

```typescript
class ModuleError extends Error {
  constructor(
    message: string,
    public readonly module: string,
    public readonly code: string,
    public readonly actionable: string,  // What the user should do
    public readonly details?: unknown
  ) {
    super(message);
  }
}
```

Error codes by convention: `<MODULE>_<CATEGORY>_<SPECIFIC>` (e.g., `FUNCTIONAL_BROWSER_LAUNCH_FAILED`)
