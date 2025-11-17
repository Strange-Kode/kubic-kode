import { kubicLog } from "../../kubic-log.js";
import { serializeRecursively } from "../../game-utility/game-utility.js";

export default {
  async init() {
    kubicLog.info('[tilemap] Module initialized');
  },

  /**
   * Process tilemap data and generate debug information
   * @param {Object} tileMap - The tilemap to process
   * @returns {Object} Serialized tilemap
   */
  processTileMapData(tileMap) {
    const MAX_SIZE = 5;
    const isLargeTileMap = tileMap.getWidth() > MAX_SIZE || tileMap.getHeight() > MAX_SIZE;
    
    // Always return the full tilemap to the client
    const responseTileMap = serializeRecursively(tileMap);
    
    let debugInfo = {
      total_tiles: tileMap.getTotalTiles(),
      occupied_tiles: tileMap.getOccupiedCount(),
      free_tiles: tileMap.getTotalTiles() - tileMap.getOccupiedCount(),
      dimensions: { width: tileMap.getWidth(), height: tileMap.getHeight() },
      is_large_tilemap: isLargeTileMap
    };
    
    if (isLargeTileMap) {
      // For large tilemaps, log only a subsection (center area of the tilemap)
      const startX = Math.max(0, Math.floor((tileMap.getWidth() - MAX_SIZE) / 2));
      const startY = Math.max(0, Math.floor((tileMap.getHeight() - MAX_SIZE) / 2));
      const endX = Math.min(tileMap.getWidth(), startX + MAX_SIZE);
      const endY = Math.min(tileMap.getHeight(), startY + MAX_SIZE);

      const subSectionTiles = tileMap.getArea(startX, startY, endX, endY);
      
      const loggedTileMap = {
        width: endX - startX,
        height: endY - startY,
        tiles: subSectionTiles,
        is_subsection: true,
        subsection_bounds: {
          start_x: startX,
          start_y: startY,
          end_x: endX,
          end_y: endY
        }
      };
      
      debugInfo.subsection_info = {
        subsection_bounds: loggedTileMap.subsection_bounds,
        subsection_dimensions: { width: loggedTileMap.width, height: loggedTileMap.height }
      };
      
      kubicLog.debug(`[tilemap] Large tilemap detected (${tileMap.getWidth()}x${tileMap.getHeight()}). Logging subsection: ${startX},${startY} to ${endX},${endY}`);
      kubicLog.debug(`[tilemap] Logged subsection:`, loggedTileMap.tiles);
    } else {
      // For small tilemaps, log the full tilemap
      kubicLog.debug(`[tilemap] Small tilemap (${tileMap.getWidth()}x${tileMap.getHeight()}). Logging full tilemap.`);
      kubicLog.debug(`[tilemap] Full tilemap:`, tileMap);
    }
    
    // Log debug information
    kubicLog.debug(`[tilemap] Debug info:`, debugInfo);
    
    return responseTileMap;
  }
};

