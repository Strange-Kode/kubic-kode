import { 
  KubicSystemError, 
  KubicValidationError, 
  ErrorFactory,
  ErrorCodes 
} from "../game-engine/kubic-kode-error.js";

class GameRegistry {
  constructor() {
    this.__registry = new Map();
  }

  get registry() {
    throw ErrorFactory.system(
      "Attempting to access registry property on GameRegistry. Not allowed, registry is a private property.",
      "GameRegistry",
      { context: { suggestion: "Use register() or createGameInstance() methods instead", property: "registry" } }
    );
  }

  register(gameVariantId, gameFactory) {
    if (this.__registry.has(gameVariantId)) {
      throw ErrorFactory.validation(
        `Variant "${gameVariantId}" already registered`,
        "gameVariantId",
        gameVariantId,
        { context: { method: "GameRegistry.register", suggestion: "Use a different variant ID or unregister the existing one first" } }
      );
    }
    this.__registry.set(gameVariantId, gameFactory);
  }

  createGameInstance(gameVariantId, sessionId, options = {}) {
    const factory = this.__registry.get(gameVariantId);
    if (!factory) {
      throw ErrorFactory.validation(
        `Unknown variant: ${gameVariantId}`,
        "gameVariantId",
        gameVariantId,
        { context: { method: "GameRegistry.createGameInstance", suggestion: "Register the variant first using register() method" } }
      );
    }
    return factory(sessionId, options);
  }
}

export const gameRegistry = new GameRegistry();
