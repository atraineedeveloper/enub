/**
 * Detects if a worker already has a schedule entry at the same day and overlapping time.
 * Works for both scholar assignments and teacher activities.
 *
 * @param {Array} existingSchedules - Array of schedules to check against
 * @param {Object} data - The new schedule data (worker_id, weekday, start_time, end_time)
 * @param {number|null} excludeId - ID to exclude (used when editing an existing record)
 * @returns {boolean} true if there is a conflict
 */
export function hasWorkerConflict(existingSchedules, data, excludeId = null) {
  return existingSchedules.some((schedule) => {
    if (excludeId && schedule.id === excludeId) return false;
    if (+schedule.worker_id !== +data.worker_id) return false;
    if (schedule.weekday !== data.weekday) return false;
    return data.start_time < schedule.end_time && schedule.start_time < data.end_time;
  });
}

/**
 * Detects if a group already has a class at the same day and overlapping time.
 *
 * @param {Array} existingSchedules - Array of scholar schedule assignments
 * @param {Object} data - The new schedule data (group_id, weekday, start_time, end_time)
 * @param {number|null} excludeId - ID to exclude (used when editing an existing record)
 * @returns {boolean} true if there is a conflict
 */
export function hasGroupConflict(existingSchedules, data, excludeId = null) {
  return existingSchedules.some((schedule) => {
    if (excludeId && schedule.id === excludeId) return false;
    if (+schedule.group_id !== +data.group_id) return false;
    if (schedule.weekday !== data.weekday) return false;
    return data.start_time < schedule.end_time && schedule.start_time < data.end_time;
  });
}
