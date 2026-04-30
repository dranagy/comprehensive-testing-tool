import type { ModuleContext, Phase, TestPhase } from "../shared/types.js";

export interface TestingModule {
  readonly id: string;
  readonly name: string;
  readonly phase: TestPhase;
  initialize(context: ModuleContext): Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generate(...args: any[]): Promise<any[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute(...args: any[]): Promise<any[]>;
  cleanup(): Promise<void>;
}

export class ModuleRegistry {
  private modules = new Map<string, TestingModule>();
  private phaseMap = new Map<TestPhase, TestingModule>();

  register(module: TestingModule): void {
    this.modules.set(module.id, module);
    this.phaseMap.set(module.phase, module);
  }

  getByPhase(phase: TestPhase): TestingModule | undefined {
    return this.phaseMap.get(phase);
  }

  getById(id: string): TestingModule | undefined {
    return this.modules.get(id);
  }

  getAll(): TestingModule[] {
    return Array.from(this.modules.values());
  }

  async initializeAll(context: ModuleContext): Promise<void> {
    for (const mod of this.modules.values()) {
      await mod.initialize(context);
    }
  }

  async cleanupAll(): Promise<void> {
    for (const mod of this.modules.values()) {
      await mod.cleanup();
    }
  }
}
