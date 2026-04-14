import { getClient, isEnabled } from "./supabaseLeads.js";

const BUCKET_NAME = "radars";
let _bucketReady = false;

async function ensureBucket() {
  if (_bucketReady) return true;
  const supabase = await getClient();
  if (!supabase) return false;

  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = (buckets || []).some((b) => b.name === BUCKET_NAME);

  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 2 * 1024 * 1024,
    });
    if (error) {
      console.warn("[Storage] Falha ao criar bucket:", error.message);
      return false;
    }
    console.log("[Storage] Bucket criado:", BUCKET_NAME);
  }

  _bucketReady = true;
  return true;
}

async function uploadRadarPdf(slug, pdfBuffer) {
  const supabase = await getClient();
  if (!supabase) return null;

  if (!(await ensureBucket())) return null;

  const filePath = `${slug}.pdf`;
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (error) {
    console.warn("[Storage] Upload falhou para", slug, error.message);
    return null;
  }

  return getPublicUrl(slug);
}

function getPublicUrl(slug) {
  const url = process.env.SUPABASE_URL;
  if (!url) return null;
  return `${url}/storage/v1/object/public/${BUCKET_NAME}/${slug}.pdf`;
}

export { ensureBucket, uploadRadarPdf, getPublicUrl, BUCKET_NAME };
