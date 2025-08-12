class GameRegistry {
  constructor() {
    this.__registry = new Map();
  }

  get registry() {
    throw new Error("Attempting to access registry property on GameRegistry. Not allowed, registry is a private property.");
  }

  register(gameVariantId, gameFactory) {
    if (this.__registry.has(gameVariantId)) {
      throw new Error(`Variant "${gameVariantId}" already registered.`);
    }
    this.__registry.set(gameVariantId, gameFactory);
  }

  createGameInstance(gameVariantId, sessionId, options = {}) {
    const factory = this.__registry.get(gameVariantId);
    if (!factory) {
      throw new Error(`Unknown variant: ${gameVariantId}`);
    }
    return factory(sessionId, options);
  }
}

export const gameRegistry = new GameRegistry();
