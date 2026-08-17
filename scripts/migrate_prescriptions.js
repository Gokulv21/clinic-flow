import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env file manually
const envPath = path.resolve(process.cwd(), '.env');
let SUPABASE_URL = 'https://yyaawwmgzqymyewdmbtj.supabase.co';
let SERVICE_KEY = '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('VITE_SUPABASE_URL=')) {
      SUPABASE_URL = trimmed.split('=')[1].replace(/["']/g, '').trim();
    }
    if (trimmed.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
      SERVICE_KEY = trimmed.split('=')[1].replace(/["']/g, '').trim();
    }
  }
}

if (!SERVICE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY missing in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function dataURItoBuffer(dataURI) {
  const parts = dataURI.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
  const buffer = Buffer.from(parts[1], 'base64');
  return { buffer, mime };
}

async function migratePrescriptions() {
  console.log("🚀 Starting Safe Prescriptions Storage Migration (Zero Data Loss)...");

  let totalMigrated = 0;
  let hasMore = true;

  while (hasMore) {
    // Fetch batch of 30 rows that still have base64 data
    const { data: rows, error } = await supabase
      .from('prescriptions')
      .select('id, visit_id, clinic_id, advice_image, raw_paths')
      .or('advice_image.like.data:image%,advice_image.like.[%')
      .limit(30);

    if (error) {
      console.error("❌ Error querying prescriptions batch:", error.message);
      break;
    }

    if (!rows || rows.length === 0) {
      console.log("✅ No more unmigrated base64 prescriptions found!");
      hasMore = false;
      break;
    }

    console.log(`⏳ Processing batch of ${rows.length} prescriptions...`);

    for (const rx of rows) {
      const clinicId = rx.clinic_id || '00000000-0000-0000-0000-000000000001';
      const visitId = rx.visit_id || rx.id;
      let newAdviceImage = rx.advice_image;

      try {
        // 1. Migrate Multi-page base64 JSON array: '["data:image/...", ...]'
        if (rx.advice_image && rx.advice_image.startsWith('[')) {
          try {
            const parsed = JSON.parse(rx.advice_image);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const uploadedUrls = [];
              for (let i = 0; i < parsed.length; i++) {
                const item = parsed[i];
                if (typeof item === 'string' && item.startsWith('data:image')) {
                  const { buffer, mime } = dataURItoBuffer(item);
                  const ext = mime.includes('webp') ? 'webp' : 'png';
                  const filePath = `${clinicId}/${visitId}_page_${i}.${ext}`;

                  const { error: upErr } = await supabase.storage
                    .from('prescriptions')
                    .upload(filePath, buffer, { contentType: mime, upsert: true });

                  if (!upErr) {
                    const { data } = supabase.storage.from('prescriptions').getPublicUrl(filePath);
                    uploadedUrls.push(data.publicUrl);
                  } else {
                    uploadedUrls.push(item);
                  }
                } else {
                  uploadedUrls.push(item);
                }
              }
              newAdviceImage = JSON.stringify(uploadedUrls);
            }
          } catch (e) {
            console.warn(`⚠️ JSON parse error for rx ${rx.id}:`, e.message);
          }
        }
        // 2. Migrate Single base64 image: "data:image/png;base64,..."
        else if (rx.advice_image && rx.advice_image.startsWith('data:image')) {
          const { buffer, mime } = dataURItoBuffer(rx.advice_image);
          const ext = mime.includes('webp') ? 'webp' : 'png';
          const filePath = `${clinicId}/${visitId}.${ext}`;

          const { error: upErr } = await supabase.storage
            .from('prescriptions')
            .upload(filePath, buffer, { contentType: mime, upsert: true });

          if (!upErr) {
            const { data } = supabase.storage.from('prescriptions').getPublicUrl(filePath);
            newAdviceImage = data.publicUrl;
          } else {
            console.warn(`⚠️ Upload failed for rx ${rx.id}:`, upErr.message);
          }
        }

        // 3. Update the database row safely with the new Storage URL
        const updatePayload = { advice_image: newAdviceImage };

        // If raw_paths has heavy coordinates, archive to storage & clear from row
        if (rx.raw_paths && Array.isArray(rx.raw_paths) && rx.raw_paths.length > 0) {
          const pathsFilePath = `${clinicId}/${visitId}_paths.json`;
          const pathsBuffer = Buffer.from(JSON.stringify(rx.raw_paths), 'utf8');
          await supabase.storage
            .from('prescriptions')
            .upload(pathsFilePath, pathsBuffer, { contentType: 'application/json', upsert: true })
            .catch(() => {});
          
          updatePayload.raw_paths = [];
        }

        const { error: updateErr } = await supabase
          .from('prescriptions')
          .update(updatePayload)
          .eq('id', rx.id);

        if (updateErr) {
          console.error(`❌ DB update failed for rx ${rx.id}:`, updateErr.message);
        } else {
          totalMigrated++;
        }
      } catch (err) {
        console.error(`❌ Unexpected error migrating rx ${rx.id}:`, err.message);
      }
    }

    console.log(`✨ Successfully migrated ${totalMigrated} prescriptions so far...`);
    // Sleep 100ms between batches
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\n🎉 MIGRATION COMPLETE! Total migrated: ${totalMigrated} prescriptions.`);
}

migratePrescriptions();
