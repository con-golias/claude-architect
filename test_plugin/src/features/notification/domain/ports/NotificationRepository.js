/**
 * Notification repository port (interface).
 * Implemented in infrastructure layer.
 *
 * @module NotificationRepository
 *
 * @typedef {Object} NotificationRepository
 * @property {function(string): Promise<Notification|null>} findById
 * @property {function(Notification): Promise<void>} save
 * @property {function(string): Promise<void>} delete
 */

// JavaScript doesn't have interfaces — this file documents the contract.
// Infrastructure implementations must follow the typedef above.
// See: infrastructure/repositories/NotificationRepositoryImpl.js
