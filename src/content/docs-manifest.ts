export type DocCategory = "SDS" | "EPA" | "Label" | "TDS" | "SOP" | "Other";

export type DocItem = {
  id: string;
  title: string;
  category: DocCategory;
  // S3 object key inside your bucket (e.g. "sds/FUZE_Textile_SDS.pdf")
  s3Key: string;
  // file name shown to users
  filename: string;
  // optional note shown under title
  note?: string;
};

export const DOCS: DocItem[] = [
  {
    id: "sds-textile",
    title: "FUZE Textile SDS",
    category: "SDS",
    s3Key: "sds/FUZE_Textile_SDS.pdf",
    filename: "FUZE_Textile_SDS.pdf",
    note: "Safety Data Sheet (Textile)"
  },
  {
    id: "sds-surface",
    title: "FUZE Surface Sanitizer SDS",
    category: "SDS",
    s3Key: "sds/FUZE_Surface_SDS.pdf",
    filename: "FUZE_Surface_SDS.pdf",
    note: "Safety Data Sheet (Surface)"
  },
  {
    id: "epa-registrations",
    title: "EPA Registration Numbers (Reference)",
    category: "EPA",
    s3Key: "epa/EPA_Registration_Reference.pdf",
    filename: "EPA_Registration_Reference.pdf",
    note: "For quoting / compliance reference"
  }
];
