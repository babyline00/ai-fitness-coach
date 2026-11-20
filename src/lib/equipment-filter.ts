/**
 * Equipment-aware filtering. A user can only do exercises whose equipment is
 * in the set of equipment they own — with one exception: bodyweight exercises
 * are always available regardless of the user's owned-equipment set.
 */

import type { Equipment, Exercise } from './exercise-data'

/**
 * Return only exercises whose equipment is in `ownedEquipment`, OR whose
 * equipment is `bodyweight` (bodyweight is always available).
 */
export function filterByEquipment(
  exercises: Exercise[],
  ownedEquipment: Equipment[],
): Exercise[] {
  const owned = new Set<Equipment>(ownedEquipment)
  // bodyweight is always implicitly owned
  owned.add('bodyweight')
  return exercises.filter((ex) => owned.has(ex.equipment))
}

/**
 * Convenience: does the user own the equipment required by the exercise?
 */
export function canPerform(ex: Exercise, ownedEquipment: Equipment[]): boolean {
  if (ex.equipment === 'bodyweight') return true
  return ownedEquipment.includes(ex.equipment)
}
