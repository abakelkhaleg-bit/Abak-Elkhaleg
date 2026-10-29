/** محافظات جمهورية مصر العربية (27 محافظة). القيمة المخزنة هي `id`. */
export const EGYPT_GOVERNORATES = [
  { id: "cairo", name: "القاهرة" },
  { id: "giza", name: "الجيزة" },
  { id: "alexandria", name: "الإسكندرية" },
  { id: "qalyubia", name: "القليوبية" },
  { id: "sharqia", name: "الشرقية" },
  { id: "dakahlia", name: "الدقهلية" },
  { id: "gharbia", name: "الغربية" },
  { id: "monufia", name: "المنوفية" },
  { id: "beheira", name: "البحيرة" },
  { id: "kafr-el-sheikh", name: "كفر الشيخ" },
  { id: "damietta", name: "دمياط" },
  { id: "port-said", name: "بورسعيد" },
  { id: "ismailia", name: "الإسماعيلية" },
  { id: "suez", name: "السويس" },
  { id: "north-sinai", name: "شمال سيناء" },
  { id: "south-sinai", name: "جنوب سيناء" },
  { id: "faiyum", name: "الفيوم" },
  { id: "beni-suef", name: "بني سويف" },
  { id: "minya", name: "المنيا" },
  { id: "asyut", name: "أسيوط" },
  { id: "sohag", name: "سوهاج" },
  { id: "qena", name: "قنا" },
  { id: "luxor", name: "الأقصر" },
  { id: "aswan", name: "أسوان" },
  { id: "red-sea", name: "البحر الأحمر" },
  { id: "new-valley", name: "الوادي الجديد" },
  { id: "matrouh", name: "مطروح" },
] as const;

export type GovernorateId = (typeof EGYPT_GOVERNORATES)[number]["id"];

export const GOVERNORATE_IDS = EGYPT_GOVERNORATES.map((g) => g.id) as [
  GovernorateId,
  ...GovernorateId[],
];

export function governorateName(id: string): string | undefined {
  return EGYPT_GOVERNORATES.find((g) => g.id === id)?.name;
}
