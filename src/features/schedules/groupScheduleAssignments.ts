import type { ScheduleAssignment } from "./useScheduleAssignments";

export const groupScheduleAssignments = (
  array: ScheduleAssignment[],
  key: "subject_id" | "group_id"
) => {
  return array.reduce(
    (result: Record<string, ScheduleAssignment[]>, currentValue) => {
      // Obtén el valor de la propiedad por la que vamos a agrupar
      const groupKey = String(currentValue[key]);

      // Si el grupo aún no existe, créalo
      if (!result[groupKey]) {
        result[groupKey] = [];
      }

      // Agrega el elemento actual al grupo correspondiente
      result[groupKey].push(currentValue);

      return result;
    },
    {}
  );
};

