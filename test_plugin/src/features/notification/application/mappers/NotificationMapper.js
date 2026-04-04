/**
 * Notification mapper — converts between domain entities and DTOs.
 *
 * @module NotificationMapper
 */

/**
 * Maps Notification entities to/from DTOs.
 */
export class NotificationMapper {
  /**
   * Convert domain entity to output DTO.
   *
   * @param {Object} entity - Domain entity
   * @returns {Object} Output DTO
   */
  static toOutput(entity) {
    return {
      id: entity.id,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
