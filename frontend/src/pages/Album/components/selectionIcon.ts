import Check from "@assets/images/icons/check.svg?react";
import CheckPartial from "@assets/images/icons/checkPartial.svg?react";
import Circle from "@assets/images/icons/circle.svg?react";

/** The ring for nothing, the dotted ring for some, the checked circle for all. */
export function selectionIcon(all: boolean, some: boolean) {
  if (all) return Check;
  return some ? CheckPartial : Circle;
}
