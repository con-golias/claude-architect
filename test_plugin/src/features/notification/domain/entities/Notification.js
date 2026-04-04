/**
 * Notification entity — Push notification system for user alerts
 *
 * @module Notification
 */

/**
 * Notification domain entity.
 * Contains business logic and invariants.
 */
export class Notification {
  /**
   * @param {Object} props
   * @param {string} props.id
   * @param {Date} props.createdAt
   * @param {Date} props.updatedAt
   */
  constructor(props) {
    this.id = props.id;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
