import type * as T from 'three';
import { createSchoolCampus, LOCATIONS } from './xuanhoa-primary-school';

export interface XuanHoaSecondarySchoolModel extends T.Group {
  dispose: () => void;
}

export const XUANHOA_SECONDARY_SCHOOL_LOCATION = LOCATIONS.secondary;

/**
 * Exact 100% port of Codex model `outputs/khuon-vien-truong/campus.js` + `gates.js` (`createSchoolCampus('secondary')`).
 */
export function createXuanHoaSecondarySchool(): XuanHoaSecondarySchoolModel {
  return createSchoolCampus('secondary');
}
