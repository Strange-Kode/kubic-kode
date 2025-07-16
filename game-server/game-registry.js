class GameRegistry {
  constructor() {
    this.registry = new Map();
  }

  register(gameVariantId, gameFactory) {
    if (this.registry.has(gameVariantId)) {
      throw new Error(`Variant "${gameVariantId}" already registered.`);
    }
    this.registry.set(gameVariantId, gameFactory);
  }

  createGameInstance(gameVariantId, sessionId) {
    const factory = this.registry.get(gameVariantId);
    if (!factory) {
      throw new Error(`Unknown variant: ${gameVariantId}`);
    }
    return factory(sessionId);
  }
}

export const gameRegistry = new GameRegistry();
