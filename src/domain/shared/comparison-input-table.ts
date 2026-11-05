export const comparisonInputTableLabels = {
  item: "比較項目",
  diningCategory: "餐飲分類",
  people: "用餐人數",
  diningArea: "用餐區面積",
  kitchenArea: "廚房面積",
  effectiveVolume: "設備除油室有效容積 V",
  designFlowCapacity: "設備流量能力 Q",
  greaseCapacity: "設備油脂截留量 G",
  equipmentEvidence: "能力資料來源／證據",
  waterParameter: "水量計算參數",
  useTime: "計算時間 t",
  areaParameters: "面積換算參數",
  safetyFactor: "計算係數 k",
  greaseCleaningPeriod: "預定油脂清除週期",
  sedimentCleaningPeriod: "預定沉積殘留物清除週期",
  dataSource: "資料來源",
  selectionBasis: "取值依據（選填）",
  supplementaryData: "補充資料（選填）",
} as const;

export const calculationDisplayUnits = {
  seatUtilization: "人/(餐位·日)",
  dimensionless: "無單位",
} as const;
