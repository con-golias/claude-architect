/**
 * CreateNotification use case.
 * Orchestrates domain objects to create a new Notification.
 *
 * @module CreateNotificationUseCase
 */

import { Notification } from "../../domain/entities/Notification.js";
import { NotificationMapper } from "../mappers/NotificationMapper.js";

/**
 * Use case: Create a new Notification.
 *
 * @param {Object} input - Creation input data
 * @param {Object} repository - Notification repository (injected)
 * @returns {Promise<Object>} Created Notification output DTO
 */
export async function createNotification(input, repository) {
  const entity = new Notification({
    id: crypto.randomUUID(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await repository.save(entity);

  return NotificationMapper.toOutput(entity);
}
